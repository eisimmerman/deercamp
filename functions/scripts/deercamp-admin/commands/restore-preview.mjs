import { initializeFirestore } from "../lib/firestore.mjs";
import {
  buildRestorePlan,
  classifyRestoreTargets,
  readAndValidateBackup
} from "../lib/backup-restore.mjs";
import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";
import { validateCampIds } from "./clone-preview.mjs";

function validateTargetCampId(targetCampId) {
  validateCampIds("__backup_source__", targetCampId);
}

export async function runRestorePreview({
  backupFile,
  targetCampId,
  projectId
}) {
  validateTargetCampId(targetCampId);

  const { backup, resolvedPath } =
    await readAndValidateBackup(backupFile);

  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  const plan = buildRestorePlan(db, backup, targetCampId);
  const classification = await classifyRestoreTargets(db, plan);

  printTitle("DeerCamp Firestore Restore Preview");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Backup file:", resolvedPath);
  printKeyValue("Backup camp:", backup.campId);
  printKeyValue("Target camp:", targetCampId);

  printSection("RESTORE PLAN");
  printKeyValue("Camp tree docs:", plan.campDocuments.length);
  printKeyValue("Related top-level:", plan.relatedDocuments.length);
  printKeyValue("Would create:", classification.creates);
  printKeyValue("Would overwrite:", classification.overwrites);
  printKeyValue("Would delete:", 0);
  printKeyValue("Total writes:", plan.totalDocuments);

  printSection("RESULT");
  console.log("READY TO RESTORE");
  console.log("Restore never deletes extra target documents in v0.7.");

  blankLine();
  console.log("No Firestore data was changed.");

  return { plan, classification, backup, resolvedPath };
}

export async function executeRestorePreview(options) {
  try {
    await runRestorePreview(options);
  } catch (error) {
    printError("RESTORE PREVIEW FAILED", error);
    process.exitCode = 1;
  }
}
