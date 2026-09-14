// Firebase Functions helper for CampResources
function getGoogleApiKey(){
  if(process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  if(process.env.PLACES_API_KEY) return process.env.PLACES_API_KEY;
  try {
    const functions = require("firebase-functions");
    return functions.config()?.google?.maps_key || functions.config()?.places?.api_key || "";
  } catch(_) {
    return "";
  }
}

async function campResourcesHandler(req, res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const GOOGLE_API_KEY = getGoogleApiKey();
    if(!GOOGLE_API_KEY) return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });

    const {
      zip,
      radiusMiles = 25,
      query,
      strategy = "sah",
      startZip = "",
      endZip = "",
      categoryId = ""
    } = req.body || {};

    if(!query) return res.status(400).json({ error: "Missing query" });

    const radiusNumber = Number(radiusMiles || 25);
    const safeRadiusMiles = Number.isFinite(radiusNumber) && radiusNumber > 0 ? radiusNumber : 25;
    const radiusMeters = Math.min(Math.round(safeRadiusMiles * 1609.34), 80467);
    const cleanStrategy = String(strategy || "sah").trim().toLowerCase();

    if(cleanStrategy === "s2c"){
      if(!startZip || !endZip) return res.status(400).json({ error: "Missing startZip or endZip for S2C" });

      const route = await getDrivingRouteByZip(startZip, endZip);
      const sampled = sampleRoutePoints(route.points, 8, 0.28, 0.96);

      const all = [];
      for(let i = 0; i < sampled.length; i++){
        const point = sampled[i];
        const places = await searchPlacesText({
          lat: point.lat,
          lng: point.lng,
          radiusMeters,
          query
        });

        places.forEach(place => {
          const normalized = normalizePlaceForRoute(place, route.points, i, sampled.length);
          if(normalized && typeof normalized.distanceMiles === "number" && normalized.distanceMiles <= safeRadiusMiles + 0.25){
            all.push(normalized);
          }
        });
      }

      let deduped = dedupePlaces(all);
      const beyondStart = deduped.filter(place => Number(place.routeProgress || 0) >= 0.25);
      if(beyondStart.length) deduped = beyondStart;

      const results = deduped
        .sort((a,b) => {
          const orderDiff = Number(a.routeOrder ?? 999) - Number(b.routeOrder ?? 999);
          if(Math.abs(orderDiff) > 0.1) return orderDiff;
          return Number(a.distanceMiles || 999) - Number(b.distanceMiles || 999);
        })
        .slice(0, 20)
        .map(stripInternalRouteFields);

      return res.json({
        strategy: "s2c",
        startZip,
        endZip,
        radiusMiles: safeRadiusMiles,
        categoryId,
        routeMiles: route.distanceMiles,
        results
      });
    }

    if(!zip) return res.status(400).json({ error: "Missing zip" });

    const origin = await geocodeZip(zip);
    const places = await searchPlacesText({ lat: origin.lat, lng: origin.lng, radiusMeters, query });
    const results = places
      .map(place => normalizePlace(place, origin))
      .filter(place => place && typeof place.distanceMiles === "number" && place.distanceMiles <= safeRadiusMiles + 0.25)
      .sort((a, b) => (a.distanceMiles || 999) - (b.distanceMiles || 999))
      .slice(0, 20);

    res.json({ strategy: cleanStrategy, zip, radiusMiles: safeRadiusMiles, categoryId, results });
  }catch(err){
    console.error("campResourcesHandler error", err);
    res.status(500).json({ error: err.message || "Failed to load camp resources" });
  }
}

async function geocodeZip(zip){
  const GOOGLE_API_KEY = getGoogleApiKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", String(zip));
  url.searchParams.set("components", "country:US|postal_code:" + String(zip));
  url.searchParams.set("key", GOOGLE_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if(data?.error_message) throw new Error("Geocoding failed: " + data.error_message);

  const location = data?.results?.[0]?.geometry?.location;
  if(!location) throw new Error("Could not geocode ZIP " + zip);

  return { lat: location.lat, lng: location.lng };
}

async function getDrivingRouteByZip(startZip, endZip){
  const GOOGLE_API_KEY = getGoogleApiKey();

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.polyline.encodedPolyline"
    },
    body: JSON.stringify({
      origin: {
        address: String(startZip)
      },
      destination: {
        address: String(endZip)
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      languageCode: "en-US",
      units: "IMPERIAL"
    })
  });

  const data = await response.json().catch(() => ({}));

  if(!response.ok || data?.error?.message){
    throw new Error("Routes failed: " + (data?.error?.message || response.status));
  }

  const route = data?.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if(!encoded) throw new Error("No route found between ZIP codes.");

  const points = decodePolyline(encoded);
  const meters = Number(route?.distanceMeters || 0);

  return {
    points,
    distanceMiles: meters ? meters / 1609.34 : estimateRouteMiles(points)
  };
}

async function searchPlacesText({ lat, lng, radiusMeters, query }){
  const GOOGLE_API_KEY = getGoogleApiKey();

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.googleMapsUri",
        "places.currentOpeningHours.openNow",
        "places.location"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters
        }
      }
    })
  });

  const data = await response.json();
  if(data?.error?.message) throw new Error("Places failed: " + data.error.message);

  return Array.isArray(data.places) ? data.places : [];
}

function normalizePlace(place, origin){
  const loc = place.location || {};
  const lat = loc.latitude;
  const lng = loc.longitude;

  if(typeof lat !== "number" || typeof lng !== "number") return null;

  const distanceMiles = haversineMiles(origin.lat, origin.lng, lat, lng);

  return {
    placeId: place.id || "",
    name: place.displayName?.text || "Unknown place",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    rating: place.rating || null,
    mapsUrl: place.googleMapsUri || "",
    openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
    distanceMiles
  };
}

function normalizePlaceForRoute(place, routePoints, searchOrder, searchCount){
  const loc = place.location || {};
  const lat = loc.latitude;
  const lng = loc.longitude;

  if(typeof lat !== "number" || typeof lng !== "number") return null;

  const nearest = nearestRoutePoint(lat, lng, routePoints);
  const progress = routePoints.length > 1 ? nearest.index / (routePoints.length - 1) : 0;
  const routeOrder = progress * 1000 + (searchOrder / Math.max(searchCount, 1));

  return {
    placeId: place.id || "",
    name: place.displayName?.text || "Unknown place",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    rating: place.rating || null,
    mapsUrl: place.googleMapsUri || "",
    openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
    distanceMiles: nearest.distanceMiles,
    routeProgress: progress,
    routeOrder
  };
}

function stripInternalRouteFields(place){
  const copy = { ...place };
  delete copy.routeOrder;
  delete copy.routeProgress;
  return copy;
}

function dedupePlaces(items){
  const byKey = new Map();

  for(const item of items || []){
    const key = String(item.placeId || `${item.name}|${item.address}`).toLowerCase();
    if(!key.trim()) continue;

    const existing = byKey.get(key);
    if(!existing || Number(item.distanceMiles || 999) < Number(existing.distanceMiles || 999)){
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values());
}

function sampleRoutePoints(points, maxPoints = 8, startProgress = 0, endProgress = 1){
  if(!Array.isArray(points) || !points.length) return [];
  const safeStart = Math.max(0, Math.min(1, Number(startProgress) || 0));
  const safeEnd = Math.max(safeStart, Math.min(1, Number(endProgress) || 1));
  const last = points.length - 1;
  const startIdx = Math.round(safeStart * last);
  const endIdx = Math.round(safeEnd * last);
  const usable = points.slice(startIdx, endIdx + 1);
  if(usable.length <= maxPoints) return usable;

  const out = [];
  const usableLast = usable.length - 1;

  for(let i = 0; i < maxPoints; i++){
    const idx = Math.round((i / (maxPoints - 1)) * usableLast);
    out.push(usable[idx]);
  }

  return out;
}

function nearestRoutePoint(lat, lng, points){
  let best = { index: 0, distanceMiles: Number.POSITIVE_INFINITY };

  for(let i = 0; i < points.length; i++){
    const p = points[i];
    const distanceMiles = haversineMiles(lat, lng, p.lat, p.lng);
    if(distanceMiles < best.distanceMiles){
      best = { index: i, distanceMiles };
    }
  }

  return best;
}

function estimateRouteMiles(points){
  if(!Array.isArray(points) || points.length < 2) return 0;
  let miles = 0;

  for(let i = 1; i < points.length; i++){
    miles += haversineMiles(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }

  return miles;
}

function decodePolyline(encoded){
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while(index < encoded.length){
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while(b >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while(b >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
}

function haversineMiles(lat1, lon1, lat2, lon2){
  const R = 3958.7613;
  const toRad = d => Number(d) * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon/2)**2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = { campResourcesHandler };
