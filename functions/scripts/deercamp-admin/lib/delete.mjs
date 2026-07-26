import {
  findTopLevelCampReferences,
  listTopLevelCollections
} from "./firestore.mjs";
import { collectDocumentTree } from "./camp-tree.mjs";

function pathDepth(documentPath) {
  return documentPath.split("/").length;
}

async function deletePaths(db, paths) {
  if (!paths.length) return 0;

  const writer = db.bulkWriter();
  for (const documentPath of paths) {
    writer.delete(db.doc(documentPath));
  }
  await writer.close();
  return paths.length;
}

export async function buildDeletePlan(db, campId) {
  const campRef = db.collection("camps").doc(campId);
  const treeDocuments = await collectDocumentTree(campRef);

  if (!treeDocuments.length) {
    throw new Error(`Camp document does not exist: camps/${campId}`);
  }

  const collections = await listTopLevelCollections(db);
  const { references, skipped } = await findTopLevelCampReferences(
    db,
    campId,
    collections
  );

  const relatedPaths = references
    .filter((documentPath) => documentPath !== campRef.path)
    .sort((left, right) => left.localeCompare(right));

  const descendantPaths = treeDocuments
    .map((item) => item.path)
    .filter((documentPath) => documentPath !== campRef.path)
    .sort((left, right) => {
      const depthDifference = pathDepth(right) - pathDepth(left);
      return depthDifference || left.localeCompare(right);
    });

  return {
    campId,
    campPath: campRef.path,
    relatedPaths,
    descendantPaths,
    skippedCollections: skipped,
    totalDocuments:
      relatedPaths.length + descendantPaths.length + 1
  };
}

export async function executeDeletePlan(db, plan) {
  // Dependency-safe sequence:
  // 1. Related top-level documents
  // 2. Deepest camp descendants first
  // 3. Root camp document last
  const relatedDeleted = await deletePaths(db, plan.relatedPaths);
  const descendantsDeleted = await deletePaths(
    db,
    plan.descendantPaths
  );
  const rootDeleted = await deletePaths(db, [plan.campPath]);

  return {
    relatedDeleted,
    descendantsDeleted,
    rootDeleted,
    totalDeleted:
      relatedDeleted + descendantsDeleted + rootDeleted
  };
}

export async function verifyDelete(db, plan) {
  const remaining = [];

  for (const documentPath of [
    ...plan.relatedPaths,
    ...plan.descendantPaths,
    plan.campPath
  ]) {
    const snapshot = await db.doc(documentPath).get();
    if (snapshot.exists) remaining.push(documentPath);
  }

  const collections = await listTopLevelCollections(db);
  const { references: remainingReferences, skipped } =
    await findTopLevelCampReferences(db, plan.campId, collections);

  for (const referencePath of remainingReferences) {
    if (!remaining.includes(referencePath)) {
      remaining.push(referencePath);
    }
  }

  remaining.sort((left, right) => left.localeCompare(right));

  return {
    passed: remaining.length === 0,
    expectedDeleted: plan.totalDocuments,
    remaining,
    skippedCollections: skipped
  };
}
