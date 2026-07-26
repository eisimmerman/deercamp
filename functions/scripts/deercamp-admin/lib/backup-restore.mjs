import fs from "node:fs/promises";
import path from "node:path";
import admin from "firebase-admin";

function reviveFirestoreValue(value, db) {
  if (Array.isArray(value)) {
    return value.map((item) => reviveFirestoreValue(item, db));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value.__type === "firestore/timestamp") {
    return new admin.firestore.Timestamp(
      Number(value.seconds),
      Number(value.nanoseconds)
    );
  }

  if (value.__type === "firestore/geopoint") {
    return new admin.firestore.GeoPoint(
      Number(value.latitude),
      Number(value.longitude)
    );
  }

  if (value.__type === "firestore/document-reference") {
    return db.doc(String(value.path));
  }

  if (value.__type === "buffer") {
    return Buffer.from(String(value.base64), "base64");
  }

  if (value.__type === "date") {
    return new Date(String(value.iso));
  }

  const revived = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    revived[key] = reviveFirestoreValue(nestedValue, db);
  }

  return revived;
}

function replaceCampIdDeep(value, sourceCampId, targetCampId) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceCampIdDeep(item, sourceCampId, targetCampId)
    );
  }

  if (value && typeof value === "object") {
    if (value instanceof Date ||
        value instanceof admin.firestore.Timestamp ||
        value instanceof admin.firestore.GeoPoint ||
        value instanceof admin.firestore.DocumentReference ||
        Buffer.isBuffer(value)) {
      return value;
    }

    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = replaceCampIdDeep(
        nestedValue,
        sourceCampId,
        targetCampId
      );
    }
    return output;
  }

  if (typeof value === "string" && value === sourceCampId) {
    return targetCampId;
  }

  return value;
}

function flattenCampTree(node, output = []) {
  if (!node || !node.exists) return output;

  output.push({
    sourcePath: node.path,
    data: node.data || {}
  });

  for (const collection of node.subcollections || []) {
    for (const child of collection.documents || []) {
      flattenCampTree(child, output);
    }
  }

  return output;
}

function mapCampTreePath(sourcePath, sourceCampId, targetCampId) {
  const sourcePrefix = `camps/${sourceCampId}`;
  const targetPrefix = `camps/${targetCampId}`;

  if (!sourcePath.startsWith(sourcePrefix)) {
    throw new Error(`Unexpected backup camp path: ${sourcePath}`);
  }

  return `${targetPrefix}${sourcePath.slice(sourcePrefix.length)}`;
}

function relatedTargetPath(sourcePath, sourceCampId, targetCampId) {
  if (sourceCampId === targetCampId) return sourcePath;

  const segments = sourcePath.split("/");
  const sourceId = segments.pop();
  const collectionPath = segments.join("/");
  return `${collectionPath}/${targetCampId}__restore__${sourceId}`;
}

export async function readAndValidateBackup(backupFile) {
  const resolvedPath = path.resolve(backupFile);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const backup = JSON.parse(raw);

  if (backup?.format !== "deercamp-camp-backup") {
    throw new Error("File is not a CampOps camp backup.");
  }

  if (Number(backup?.formatVersion) !== 1) {
    throw new Error(
      `Unsupported backup format version: ${backup?.formatVersion}`
    );
  }

  if (!backup?.campId || !backup?.campTree) {
    throw new Error("Backup is missing campId or campTree.");
  }

  return { backup, resolvedPath };
}

export function buildRestorePlan(db, backup, targetCampId) {
  const sourceCampId = String(backup.campId);
  const campDocuments = flattenCampTree(backup.campTree).map((item) => ({
    sourcePath: item.sourcePath,
    targetPath: mapCampTreePath(
      item.sourcePath,
      sourceCampId,
      targetCampId
    ),
    data: replaceCampIdDeep(
      reviveFirestoreValue(item.data, db),
      sourceCampId,
      targetCampId
    )
  }));

  const relatedDocuments = (backup.referencedDocuments || [])
    .filter((item) => item?.exists && item?.path !== `camps/${sourceCampId}`)
    .map((item) => ({
      sourcePath: item.path,
      targetPath: relatedTargetPath(
        item.path,
        sourceCampId,
        targetCampId
      ),
      data: replaceCampIdDeep(
        reviveFirestoreValue(item.data || {}, db),
        sourceCampId,
        targetCampId
      )
    }));

  return {
    sourceCampId,
    targetCampId,
    campDocuments,
    relatedDocuments,
    totalDocuments: campDocuments.length + relatedDocuments.length
  };
}

export async function classifyRestoreTargets(db, plan) {
  let creates = 0;
  let overwrites = 0;

  for (const item of [...plan.campDocuments, ...plan.relatedDocuments]) {
    const snapshot = await db.doc(item.targetPath).get();
    if (snapshot.exists) overwrites += 1;
    else creates += 1;
  }

  return { creates, overwrites };
}

export async function executeRestorePlan(db, plan) {
  const writer = db.bulkWriter();
  let writes = 0;

  for (const item of [...plan.campDocuments, ...plan.relatedDocuments]) {
    writer.set(db.doc(item.targetPath), item.data);
    writes += 1;
  }

  await writer.close();
  return writes;
}

export async function verifyRestore(db, plan) {
  const missing = [];

  for (const item of [...plan.campDocuments, ...plan.relatedDocuments]) {
    const snapshot = await db.doc(item.targetPath).get();
    if (!snapshot.exists) missing.push(item.targetPath);
  }

  return {
    passed: missing.length === 0,
    expectedDocuments: plan.totalDocuments,
    missing
  };
}
