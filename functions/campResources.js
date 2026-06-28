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

    const { zip, radiusMiles = 25, query } = req.body || {};
    if(!zip || !query) return res.status(400).json({ error: "Missing zip or query" });

    const origin = await geocodeZip(zip);
    const radiusNumber = Number(radiusMiles || 25);
    const radiusMeters = Math.min(Math.round(radiusNumber * 1609.34), 80467);

    const places = await searchPlacesText({ lat: origin.lat, lng: origin.lng, radiusMeters, query });
    const results = places
      .map(place => normalizePlace(place, origin))
      .filter(place => place && typeof place.distanceMiles === "number" && place.distanceMiles <= radiusNumber + 0.25)
      .sort((a, b) => (a.distanceMiles || 999) - (b.distanceMiles || 999))
      .slice(0, 20);

    res.json({ zip, radiusMiles: radiusNumber, results });
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

async function searchPlacesText({ lat, lng, radiusMeters, query }){
  const GOOGLE_API_KEY = getGoogleApiKey();
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": [
        "places.id","places.displayName","places.formattedAddress","places.nationalPhoneNumber",
        "places.websiteUri","places.rating","places.googleMapsUri","places.currentOpeningHours.openNow","places.location"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } }
    })
  });
  if(!response.ok) throw new Error("Places search failed: " + response.status + " " + await response.text());
  const data = await response.json();
  return data.places || [];
}

function normalizePlace(place, origin){
  const loc = place.location;
  const distanceMiles = loc ? haversineMiles(origin.lat, origin.lng, loc.latitude, loc.longitude) : null;
  return {
    placeId: place.id || "",
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    rating: place.rating || null,
    mapsUrl: place.googleMapsUri || "",
    openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
    distanceMiles
  };
}
function haversineMiles(lat1, lon1, lat2, lon2){
  const R = 3958.7613, toRad = d => Number(d) * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
module.exports = { campResourcesHandler };
