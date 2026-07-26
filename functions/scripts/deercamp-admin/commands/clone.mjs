import {
  assertWriteProjectAllowed,
  initializeFirestore
} from "../lib/firestore.mjs";
import {
  assertPlanTargetsDoNotExist,
  buildClonePlan,
  executeClonePlan,
  verifyClone
} from "../lib/clone.mjs";
import { requireExactConfirmation } from "../lib/prompt.mjs";
import { writeOperationLog } from "../lib/operation-log.mjs";
import { runBackup } from "./backup.mjs";
import { validateCampIds } from "./clone-preview.mjs";
import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

export async function runClone({
  sourceCampId,
  targetCampId,
  projectId,
  execute
}) {
  if (!execute) {
    throw new Error(
      "Clone requires the --execute flag. No action taken."
    );
  }

  validateCampIds(sourceCampId, targetCampId);

  const startedAt = new Date();
  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  assertWriteProjectAllowed(resolvedProjectId);

  printTitle("DeerCamp Firestore Guarded Clone");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Source camp:", sourceCampId);
  printKeyValue("Target camp:", targetCampId);
  printKeyValue("Execute flag:", "YES");

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

  if (plan.skippedCollections.length > 0) {
    throw new Error(
      "One or more top-level collections could not be scanned. " +
      "Clone cancelled before backup and writes."
    );
  }

  await assertPlanTargetsDoNotExist(db, plan);

  printSection("EXECUTION PLAN");
  printKeyValue("Camp tree docs:", plan.treeDocuments.length);
  printKeyValue("Related top-level:", plan.relatedDocuments.length);
  printKeyValue("Total writes:", plan.estimatedWrites);

  printSection("AUTOMATIC SOURCE BACKUP");
  const backupResult = await runBackup({
    campId: sourceCampId,
    projectId: resolvedProjectId,
    quiet: true
  });
  printKeyValue("Backup:", backupResult.outputPath);
  printKeyValue("Status:", "PASSED");

  printSection("FINAL CONFIRMATION");
  await requireExactConfirmation(targetCampId);

  printSection("EXECUTING CLONE");
  const documentsWritten = await executeClonePlan(db, plan);
  printKeyValue("Documents written:", documentsWritten);

  printSection("VERIFYING CLONE");
  const verification = await verifyClone(db, plan);
  printKeyValue("Expected:", verification.expectedDocuments);
  printKeyValue("Missing:", verification.missing.length);
  printKeyValue("Verification:", verification.passed ? "PASSED" : "FAILED");

  const completedAt = new Date();
  const operation = {
    operation: "clone",
    campOpsVersion: "0.6.0",
    projectId: resolvedProjectId,
    sourceCampId,
    targetCampId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    automaticBackup: backupResult.outputPath,
    documentsWritten,
    verification,
    status: verification.passed ? "success" : "failed"
  };

  const operationLogPath = await writeOperationLog(operation);

  printSection("OPERATION LOG");
  printKeyValue("File:", operationLogPath);

  if (!verification.passed) {
    throw new Error(
      "Clone writes completed, but verification failed. " +
      "Review the operation log immediately."
    );
  }

  printSection("RESULT");
  console.log("CLONE COMPLETE");
  console.log("Post-clone verification passed.");

  blankLine();
  return operation;
}

export async function executeClone(options) {
  try {
    await runClone(options);
  } catch (error) {
    printError("CLONE FAILED", error);
    process.exitCode = 1;
  }
}
