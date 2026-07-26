import {
  assertWriteProjectAllowed,
  initializeFirestore
} from "../lib/firestore.mjs";
import {
  buildRestorePlan,
  classifyRestoreTargets,
  executeRestorePlan,
  readAndValidateBackup,
  verifyRestore
} from "../lib/backup-restore.mjs";
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

function validateTargetCampId(targetCampId) {
  validateCampIds("__backup_source__", targetCampId);
}

export async function runRestore({
  backupFile,
  targetCampId,
  projectId,
  execute
}) {
  if (!execute) {
    throw new Error(
      "Restore requires the --execute flag. No action taken."
    );
  }

  validateTargetCampId(targetCampId);

  const startedAt = new Date();
  const { backup, resolvedPath } =
    await readAndValidateBackup(backupFile);

  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  assertWriteProjectAllowed(resolvedProjectId);

  const plan = buildRestorePlan(db, backup, targetCampId);
  const classification = await classifyRestoreTargets(db, plan);

  printTitle("DeerCamp Firestore Guarded Restore");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Backup file:", resolvedPath);
  printKeyValue("Backup camp:", backup.campId);
  printKeyValue("Target camp:", targetCampId);
  printKeyValue("Execute flag:", "YES");

  printSection("EXECUTION PLAN");
  printKeyValue("Would create:", classification.creates);
  printKeyValue("Would overwrite:", classification.overwrites);
  printKeyValue("Would delete:", 0);
  printKeyValue("Total writes:", plan.totalDocuments);

  let safetyBackupPath = null;
  const targetSnapshot = await db.collection("camps").doc(targetCampId).get();

  if (targetSnapshot.exists) {
    printSection("AUTOMATIC TARGET SAFETY BACKUP");
    const safetyBackup = await runBackup({
      campId: targetCampId,
      projectId: resolvedProjectId,
      quiet: true
    });
    safetyBackupPath = safetyBackup.outputPath;
    printKeyValue("Backup:", safetyBackupPath);
    printKeyValue("Status:", "PASSED");
  } else {
    printSection("AUTOMATIC TARGET SAFETY BACKUP");
    console.log("Target camp does not exist; no pre-restore backup required.");
  }

  printSection("FINAL CONFIRMATION");
  await requireExactConfirmation(targetCampId);

  printSection("EXECUTING RESTORE");
  const documentsWritten = await executeRestorePlan(db, plan);
  printKeyValue("Documents written:", documentsWritten);

  printSection("VERIFYING RESTORE");
  const verification = await verifyRestore(db, plan);
  printKeyValue("Expected:", verification.expectedDocuments);
  printKeyValue("Missing:", verification.missing.length);
  printKeyValue("Verification:", verification.passed ? "PASSED" : "FAILED");

  const completedAt = new Date();
  const operation = {
    operation: "restore",
    campOpsVersion: "0.7.0",
    projectId: resolvedProjectId,
    backupFile: resolvedPath,
    backupCampId: backup.campId,
    targetCampId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    automaticTargetBackup: safetyBackupPath,
    createsPlanned: classification.creates,
    overwritesPlanned: classification.overwrites,
    deletesPlanned: 0,
    documentsWritten,
    verification,
    status: verification.passed ? "success" : "failed"
  };

  const operationLogPath = await writeOperationLog({
    ...operation,
    sourceCampId: backup.campId
  });

  printSection("OPERATION LOG");
  printKeyValue("File:", operationLogPath);

  if (!verification.passed) {
    throw new Error(
      "Restore writes completed, but verification failed. " +
      "Review the operation log immediately."
    );
  }

  printSection("RESULT");
  console.log("RESTORE COMPLETE");
  console.log("Post-restore verification passed.");
  console.log("No extra target documents were deleted.");

  blankLine();
  return operation;
}

export async function executeRestore(options) {
  try {
    await runRestore(options);
  } catch (error) {
    printError("RESTORE FAILED", error);
    process.exitCode = 1;
  }
}
