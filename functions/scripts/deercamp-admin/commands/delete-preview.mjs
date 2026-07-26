import { initializeFirestore } from "../lib/firestore.mjs";
import { buildDeletePlan } from "../lib/delete.mjs";
import { assertCampNotProtected } from "../lib/protected-camps.mjs";
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

export async function runDeletePreview({ campId, projectId }) {
  validateCampId(campId);
  const protection = await assertCampNotProtected(campId);

  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  const plan = await buildDeletePlan(db, campId);

  printTitle("DeerCamp Firestore Delete Preview");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Camp:", campId);
  printKeyValue("Protected:", "NO");
  printKeyValue("Protection file:", protection.configPath);

  printSection("DELETE PLAN");
  printKeyValue("Related top-level:", plan.relatedPaths.length);
  printKeyValue("Camp descendants:", plan.descendantPaths.length);
  printKeyValue("Camp root:", 1);
  printKeyValue("Total deletions:", plan.totalDocuments);
  printKeyValue("Skipped scans:", plan.skippedCollections.length);

  printSection("DELETE ORDER");
  console.log("1. Related top-level documents");
  console.log("2. Camp descendants, deepest first");
  console.log("3. Root camp document last");

  printSection("RESULT");
  console.log("READY TO DELETE");
  console.log("An automatic backup will be required before execution.");

  blankLine();
  console.log("No Firestore data was changed.");

  return plan;
}

export async function executeDeletePreview(options) {
  try {
    await runDeletePreview(options);
  } catch (error) {
    printError("DELETE PREVIEW FAILED", error);
    process.exitCode = 1;
  }
}
