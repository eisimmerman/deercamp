import {
  findTopLevelCampReferences,
  listTopLevelCollections
} from "./firestore.mjs";
import {
  collectDocumentTree,
  mapCampTreePath
} from "./camp-tree.mjs";

function replaceCampIdDeep(value, sourceCampId, targetCampId) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceCampIdDeep(item, sourceCampId, targetCampId)
    );
  }

  if (value && typeof value === "object") {
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

export async function buildClonePlan(db, sourceCampId, targetCampId) {
  const sourceRef = db.collection("camps").doc(sourceCampId);
  const treeDocuments = await collectDocumentTree(sourceRef);

  const collections = await listTopLevelCollections(db);
  const { references, skipped } = await findTopLevelCampReferences(
    db,
    sourceCampId,
    collections
  );

  const relatedReferences = references.filter(
    (referencePath) => referencePath !== sourceRef.path
  );

  const relatedDocuments = [];
  for (const referencePath of relatedReferences) {
    const snapshot = await db.doc(referencePath).get();
    if (snapshot.exists) {
      relatedDocuments.push({
        sourcePath: referencePath,
        sourceId: snapshot.id,
        collectionPath: snapshot.ref.parent.path,
        data: snapshot.data() || {}
      });
    }
  }

  return {
    sourceCampId,
    targetCampId,
    treeDocuments,
    relatedDocuments,
    skippedCollections: skipped,
    estimatedWrites: treeDocuments.length + relatedDocuments.length
  };
}

export async function assertPlanTargetsDoNotExist(db, plan) {
  const conflicts = [];

  for (const document of plan.treeDocuments) {
    const targetPath = mapCampTreePath(
      document.path,
      plan.sourceCampId,
      plan.targetCampId
    );
    const snapshot = await db.doc(targetPath).get();
    if (snapshot.exists) {
      conflicts.push(targetPath);
    }
  }

  for (const document of plan.relatedDocuments) {
    const targetId = `${plan.targetCampId}__clone__${document.sourceId}`;
    const targetPath = `${document.collectionPath}/${targetId}`;
    const snapshot = await db.doc(targetPath).get();
    if (snapshot.exists) {
      conflicts.push(targetPath);
    }
  }

  if (conflicts.length) {
    throw new Error(
      "Clone target conflict detected. Existing document(s):\n" +
      conflicts.join("\n")
    );
  }
}

export async function executeClonePlan(db, plan) {
  const writer = db.bulkWriter();
  let writes = 0;

  for (const document of plan.treeDocuments) {
    const targetPath = mapCampTreePath(
      document.path,
      plan.sourceCampId,
      plan.targetCampId
    );
    const targetData = replaceCampIdDeep(
      document.data,
      plan.sourceCampId,
      plan.targetCampId
    );
    writer.create(db.doc(targetPath), targetData);
    writes += 1;
  }

  for (const document of plan.relatedDocuments) {
    const targetId = `${plan.targetCampId}__clone__${document.sourceId}`;
    const targetPath = `${document.collectionPath}/${targetId}`;
    const targetData = replaceCampIdDeep(
      document.data,
      plan.sourceCampId,
      plan.targetCampId
    );
    writer.create(db.doc(targetPath), targetData);
    writes += 1;
  }

  await writer.close();
  return writes;
}

export async function verifyClone(db, plan) {
  const missing = [];

  for (const document of plan.treeDocuments) {
    const targetPath = mapCampTreePath(
      document.path,
      plan.sourceCampId,
      plan.targetCampId
    );
    const snapshot = await db.doc(targetPath).get();
    if (!snapshot.exists) {
      missing.push(targetPath);
    }
  }

  for (const document of plan.relatedDocuments) {
    const targetId = `${plan.targetCampId}__clone__${document.sourceId}`;
    const targetPath = `${document.collectionPath}/${targetId}`;
    const snapshot = await db.doc(targetPath).get();
    if (!snapshot.exists) {
      missing.push(targetPath);
    }
  }

  return {
    passed: missing.length === 0,
    expectedDocuments: plan.estimatedWrites,
    missing
  };
}
