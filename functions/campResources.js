// CampResources Cloud Function handler.
// Uses Google Geocoding + Google Places Text Search.
// Requires Firebase Functions v2 secret: GOOGLE_MAPS_API_KEY.

function getGoogleApiKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function campResourcesHandler(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const apiKey = getGoogleApiKey();
    if (!apiKey) return sendJson(res, 500, { error: "Missing GOOGLE_MAPS_API_KEY" });

    const body = req.body || {};
    const zip = String(body.zip || "").trim();
    const query = String(body.query || "").trim();
    const radiusMiles = Math.max(1, Math.min(Number(body.radiusMiles || 25), 100));

    if (!zip) return sendJson(res, 400, { error: "Missing zip" });
    if (!query) return sendJson(res, 400, { error: "Missing query" });

    const origin = await geocodeZip(zip, apiKey);
    const radiusMeters = Math.round(radiusMiles * 1609.344);

    const places = await searchPlacesText({
      apiKey,
      query,
      lat: origin.lat,
      lng: origin.lng,
      radiusMeters
    });

    const results = places
      .map(place => normalizePlace(place, origin))
      .filter(place => place && place.name)
      .sort((a, b) => Number(a.distanceMiles || 9999) - Number(b.distanceMiles || 9999))
      .slice(0, 20);

    return sendJson(res, 200, { zip, radiusMiles, results });
  } catch (error) {
    console.error("campResourcesHandler error", error && (error.stack || error.message || error));
    return sendJson(res, 500, {
      error: error && error.message ? error.message : "Failed to load CampResources"
    });
  }
}

async function geocodeZip(zip, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", zip);
  url.searchParams.set("components", `country:US|postal_code:${zip}`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.status === "REQUEST_DENIED") {
    throw new Error(`Geocoding failed: ${payload.error_message || payload.status || response.status}`);
  }

  const location = payload && payload.results && payload.results[0] && payload.results[0].geometry && payload.results[0].geometry.location;
  if (!location) throw new Error(`Could not geocode ZIP ${zip}`);

  return { lat: Number(location.lat), lng: Number(location.lng) };
}

async function searchPlacesText({ apiKey, query, lat, lng, radiusMeters }) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
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

  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) {}

  if (!response.ok) {
    const details = payload && payload.error && (payload.error.message || payload.error.status);
    throw new Error(`Places search failed: ${response.status}${details ? " " + details : ""}`);
  }

  return Array.isArray(payload.places) ? payload.places : [];
}

function normalizePlace(place, origin) {
  const loc = place.location || {};
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const distanceMiles = Number.isFinite(lat) && Number.isFinite(lng)
    ? haversineMiles(origin.lat, origin.lng, lat, lng)
    : null;

  return {
    placeId: place.id || "",
    name: place.displayName && place.displayName.text ? place.displayName.text : "",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    rating: place.rating || null,
    mapsUrl: place.googleMapsUri || "",
    openNow: typeof (place.currentOpeningHours && place.currentOpeningHours.openNow) === "boolean"
      ? place.currentOpeningHours.openNow
      : null,
    distanceMiles
  };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.7613;
  const toRad = d => Number(d) * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { campResourcesHandler };
