import {
  findTopLevelCampReferences,
  initializeFirestore,
  listTopLevelCollections
} from "../lib/firestore.mjs";

import { summarizeDocumentTree } from "../lib/camp-tree.mjs";

import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

function validateCampIds(sourceCampId, targetCampId) {
  if (sourceCampId === targetCampId) {
    throw new Error(
      "Source and target camp IDs are identical. No action taken."
    );
  }

  if (targetCampId.length < 3) {
    throw new Error(
      "Target camp ID is too short. No action taken."
    );
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(targetCampId)) {
    throw new Error(
      "Target camp ID must use lowercase letters, numbers, and hyphens only."
    );
  }
}

export async function runClonePreview({
  sourceCampId,
  targetCampId,
  projectId
}) {
  validateCampIds(sourceCampId, targetCampId);

  const {
    db,
    projectId: resolvedProjectId
  } = initializeFirestore(projectId);

  printTitle("DeerCamp Firestore Clone Preview");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Source camp:", sourceCampId);
  printKeyValue("Target camp:", targetCampId);

  const sourceRef = db.collection("camps").doc(sourceCampId);
  const targetRef = db.collection("camps").doc(targetCampId);

  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    sourceRef.get(),
    targetRef.get()
  ]);

  printSection("VALIDATION");
  printKeyValue(
    "Source exists:",
    sourceSnapshot.exists ? "YES" : "NO"
  );
  printKeyValue(
    "Target exists:",
    targetSnapshot.exists ? "YES" : "NO"
  );

  if (!sourceSnapshot.exists) {
    throw new Error(
      `Source camp not found: camps/${sourceCampId}`
    );
  }

  if (targetSnapshot.exists) {
    throw new Error(
      `Target camp already exists: camps/${targetCampId}`
    );
  }

  const treeSummary = await summarizeDocumentTree(sourceRef);

  const collections = await listTopLevelCollections(db);
  const { references, skipped } =
    await findTopLevelCampReferences(
      db,
      sourceCampId,
      collections
    );

  const nonCampReferences = references.filter(
    (referencePath) => referencePath !== sourceRef.path
  );

  const estimatedWrites =
    treeSummary.documentCount + nonCampReferences.length;

  printSection("OBJECTS TO COPY");
  printKeyValue("Camp tree docs:", treeSummary.documentCount);
  printKeyValue(
    "Subcollections:",
    treeSummary.subcollectionCount
  );
  printKeyValue(
    "Related top-level:",
    nonCampReferences.length
  );
  printKeyValue("Estimated writes:", estimatedWrites);
  printKeyValue("Skipped scans:", skipped.length);

  printSection("SOURCE DOCUMENT PATHS");

  for (const documentPath of treeSummary.documentPaths) {
    console.log(documentPath);
  }

  if (nonCampReferences.length) {
    printSection("RELATED TOP-LEVEL DOCUMENTS");

    for (const referencePath of nonCampReferences) {
      console.log(referencePath);
    }
  }

  if (skipped.length) {
    printSection("SKIPPED COLLECTIONS");

    for (const item of skipped) {
      console.log(`[${item.collectionId}] ${item.message}`);
    }
  }

  printSection("RESULT");
  console.log("READY TO CLONE");
  console.log(
    "This preview performed validation and counting only."
  );

  blankLine();
  console.log("No Firestore data was changed.");

  return {
    sourceCampId,
    targetCampId,
    projectId: resolvedProjectId,
    estimatedWrites,
    treeSummary,
    relatedTopLevelReferences: nonCampReferences,
    skippedCollections: skipped
  };
}

export async function executeClonePreview(options) {
  try {
    await runClonePreview(options);
  } catch (error) {
    printError("CLONE PREVIEW FAILED", error);
    process.exitCode = 1;
  }
}
