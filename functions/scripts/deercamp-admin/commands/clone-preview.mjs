import {
  initializeFirestore
} from "../lib/firestore.mjs";
import { buildClonePlan } from "../lib/clone.mjs";
import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

export function validateCampIds(sourceCampId, targetCampId) {
  if (sourceCampId === targetCampId) {
    throw new Error(
      "Source and target camp IDs are identical. No action taken."
    );
  }

  if (targetCampId.length < 3) {
    throw new Error("Target camp ID is too short. No action taken.");
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

  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  printTitle("DeerCamp Firestore Clone Preview");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Source camp:", sourceCampId);
  printKeyValue("Target camp:", targetCampId);

  const sourceSnapshot = await db.collection("camps").doc(sourceCampId).get();
  const targetSnapshot = await db.collection("camps").doc(targetCampId).get();

  printSection("VALIDATION");
  printKeyValue("Source exists:", sourceSnapshot.exists ? "YES" : "NO");
  printKeyValue("Target exists:", targetSnapshot.exists ? "YES" : "NO");

  if (!sourceSnapshot.exists) {
    throw new Error(`Source camp not found: camps/${sourceCampId}`);
  }

  if (targetSnapshot.exists) {
    throw new Error(`Target camp already exists: camps/${targetCampId}`);
  }

  const plan = await buildClonePlan(db, sourceCampId, targetCampId);

  printSection("OBJECTS TO COPY");
  printKeyValue("Camp tree docs:", plan.treeDocuments.length);
  printKeyValue("Related top-level:", plan.relatedDocuments.length);
  printKeyValue("Estimated writes:", plan.estimatedWrites);
  printKeyValue("Skipped scans:", plan.skippedCollections.length);

  printSection("RESULT");
  console.log("READY TO CLONE");
  console.log("This preview performed validation and counting only.");

  blankLine();
  console.log("No Firestore data was changed.");

  return plan;
}

export async function executeClonePreview(options) {
  try {
    await runClonePreview(options);
  } catch (error) {
    printError("CLONE PREVIEW FAILED", error);
    process.exitCode = 1;
  }
}
