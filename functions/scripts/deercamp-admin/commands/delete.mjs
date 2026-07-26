import {
  assertWriteProjectAllowed,
  initializeFirestore
} from "../lib/firestore.mjs";
import {
  buildDeletePlan,
  executeDeletePlan,
  verifyDelete
} from "../lib/delete.mjs";
import { assertCampNotProtected } from "../lib/protected-camps.mjs";
import { requireExactConfirmation } from "../lib/prompt.mjs";
import { writeOperationLog } from "../lib/operation-log.mjs";
import { runBackup } from "./backup.mjs";
import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

function validateCampId(campId) {
  if (campId.length < 3) {
    throw new Error("Camp ID is too short. No action taken.");
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(campId)) {
    throw new Error(
      "Camp ID must use lowercase letters, numbers, and hyphens only."
    );
  }
}

export async function runDelete({
  campId,
  projectId,
  execute
}) {
  if (!execute) {
    throw new Error(
      "Delete requires the --execute flag. No action taken."
    );
  }

  validateCampId(campId);
  const protection = await assertCampNotProtected(campId);
  const startedAt = new Date();

  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  assertWriteProjectAllowed(resolvedProjectId);
  const plan = await buildDeletePlan(db, campId);

  printTitle("DeerCamp Firestore Guarded Delete");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Camp:", campId);
  printKeyValue("Protected:", "NO");
  printKeyValue("Protection file:", protection.configPath);
  printKeyValue("Execute flag:", "YES");

  printSection("EXECUTION PLAN");
  printKeyValue("Related top-level:", plan.relatedPaths.length);
  printKeyValue("Camp descendants:", plan.descendantPaths.length);
  printKeyValue("Camp root:", 1);
  printKeyValue("Total deletions:", plan.totalDocuments);
  printKeyValue("Skipped scans:", plan.skippedCollections.length);

  printSection("AUTOMATIC SAFETY BACKUP");
  const safetyBackup = await runBackup({
    campId,
    projectId: resolvedProjectId,
    quiet: true
  });
  printKeyValue("Backup:", safetyBackup.outputPath);
  printKeyValue("Status:", "PASSED");

  printSection("FINAL CONFIRMATION");
  await requireExactConfirmation(campId);

  printSection("EXECUTING DELETE");
  const deletion = await executeDeletePlan(db, plan);
  printKeyValue("Related deleted:", deletion.relatedDeleted);
  printKeyValue("Descendants deleted:", deletion.descendantsDeleted);
  printKeyValue("Camp root deleted:", deletion.rootDeleted);
  printKeyValue("Documents deleted:", deletion.totalDeleted);

  printSection("VERIFYING DELETE");
  const verification = await verifyDelete(db, plan);
  printKeyValue("Expected deleted:", verification.expectedDeleted);
  printKeyValue("Remaining:", verification.remaining.length);
  printKeyValue(
    "Verification:",
    verification.passed ? "PASSED" : "FAILED"
  );

  const completedAt = new Date();
  const operation = {
    operation: "delete",
    campOpsVersion: "0.8.0",
    projectId: resolvedProjectId,
    sourceCampId: campId,
    targetCampId: campId,
    campId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    automaticBackup: safetyBackup.outputPath,
    planned: {
      relatedTopLevel: plan.relatedPaths.length,
      campDescendants: plan.descendantPaths.length,
      campRoot: 1,
      totalDocuments: plan.totalDocuments,
      skippedCollections: plan.skippedCollections
    },
    deletion,
    verification,
    status: verification.passed ? "success" : "failed"
  };

  const operationLogPath = await writeOperationLog(operation);

  printSection("OPERATION LOG");
  printKeyValue("File:", operationLogPath);

  if (!verification.passed) {
    throw new Error(
      "Delete completed, but verification failed. " +
      "Review the operation log and automatic backup immediately."
    );
  }

  printSection("RESULT");
  console.log("DELETE COMPLETE");
  console.log("Post-delete verification passed.");
  console.log("Automatic recovery backup is available.");

  blankLine();
  return operation;
}

export async function executeDelete(options) {
  try {
    await runDelete(options);
  } catch (error) {
    printError("DELETE FAILED", error);
    process.exitCode = 1;
  }
}
