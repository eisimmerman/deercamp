import admin from "firebase-admin";

export function normalizeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }

  if (value instanceof admin.firestore.Timestamp) {
    return {
      __type: "firestore/timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString()
    };
  }

  if (value instanceof admin.firestore.GeoPoint) {
    return {
      __type: "firestore/geopoint",
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  if (value instanceof admin.firestore.DocumentReference) {
    return {
      __type: "firestore/document-reference",
      path: value.path
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: "buffer",
      base64: value.toString("base64")
    };
  }

  if (value instanceof Date) {
    return {
      __type: "date",
      iso: value.toISOString()
    };
  }

  if (typeof value === "object") {
    const normalized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = normalizeFirestoreValue(nestedValue);
    }
    return normalized;
  }

  return value;
}

export function serializeDocumentSnapshot(snapshot) {
  return {
    path: snapshot.ref.path,
    id: snapshot.id,
    exists: snapshot.exists,
    data: snapshot.exists
      ? normalizeFirestoreValue(snapshot.data() || {})
      : null
  };
}
