#!/usr/bin/env node

import { executeBackup } from "./commands/backup.mjs";
import { executeClonePreview } from "./commands/clone-preview.mjs";
import { executeCompare } from "./commands/compare.mjs";
import { executeInspect } from "./commands/inspect.mjs";
import { DEFAULT_PROJECT_ID } from "./lib/firestore.mjs";
import { fail, printTitle } from "./lib/output.mjs";

export const VERSION = "0.5.0";

const args = process.argv.slice(2);
const command = String(args[0] || "help").trim().toLowerCase();

function printHelp() {
  printTitle(`CampOps v${VERSION}`);

  console.log("");
  console.log("Usage:");
  console.log(
    "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs " +
    "<command> [arguments]"
  );

  console.log("");
  console.log("Commands:");

  console.log("  help");
  console.log("      Show this help screen.");

  console.log("");
  console.log("  version");
  console.log("      Show the CampOps version.");

  console.log("");
  console.log("  inspect <campId> [projectId]");
  console.log("      Inspect a camp and related Firestore records.");

  console.log("");
  console.log("  backup <campId> [projectId]");
  console.log("      Export a read-only JSON backup.");

  console.log("");
  console.log("  compare <leftCampId> <rightCampId> [projectId]");
  console.log("      Compare top-level camp fields and reference counts.");

  console.log("");
  console.log(
    "  clone-preview <sourceCampId> <targetCampId> [projectId]"
  );
  console.log(
    "      Validate a proposed clone and count expected writes."
  );
  console.log("      This command performs no Firestore writes.");

  console.log("");
  console.log("Planned commands:");
  console.log("  clone      Safely clone a camp");
  console.log("  delete     Guarded camp deletion");
  console.log("  repair     Detect and repair inconsistencies");
  console.log("  doctor     Run a database-wide health check");

  console.log("");
  console.log("Safety model:");
  console.log(
    "  Inspect -> Backup -> Dry run -> Exact confirmation -> Write -> Verify"
  );

  console.log("");
}

function parseCampCommandArguments(commandName) {
  const campId = String(args[1] || "").trim();
  const projectId =
    String(args[2] || DEFAULT_PROJECT_ID).trim() ||
    DEFAULT_PROJECT_ID;

  if (!campId) {
    fail(
      `Missing camp ID for ${commandName}.\n\n` +
      "Example:\n" +
      "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs " +
      `${commandName} camp-boddington-independence-ks-67301`
    );
  }

  return {
    campId,
    projectId
  };
}

function parseCompareArguments() {
  const leftCampId = String(args[1] || "").trim();
  const rightCampId = String(args[2] || "").trim();
  const projectId =
    String(args[3] || DEFAULT_PROJECT_ID).trim() ||
    DEFAULT_PROJECT_ID;

  if (!leftCampId || !rightCampId) {
    fail(
      "Compare requires two camp IDs.\n\n" +
      "Example:\n" +
      "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs " +
      "compare camp-one camp-two"
    );
  }

  return {
    leftCampId,
    rightCampId,
    projectId
  };
}

function parseClonePreviewArguments() {
  const sourceCampId = String(args[1] || "").trim();
  const targetCampId = String(args[2] || "").trim();
  const projectId =
    String(args[3] || DEFAULT_PROJECT_ID).trim() ||
    DEFAULT_PROJECT_ID;

  if (!sourceCampId || !targetCampId) {
    fail(
      "Clone preview requires source and target camp IDs.\n\n" +
      "Example:\n" +
      "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs " +
      "clone-preview camp-source camp-target"
    );
  }

  return {
    sourceCampId,
    targetCampId,
    projectId
  };
}

async function main() {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    case "version":
    case "--version":
    case "-v":
      console.log(`CampOps v${VERSION}`);
      return;

    case "inspect":
      await executeInspect(
        parseCampCommandArguments("inspect")
      );
      return;

    case "backup":
      await executeBackup(
        parseCampCommandArguments("backup")
      );
      return;

    case "compare":
      await executeCompare(
        parseCompareArguments()
      );
      return;

    case "clone-preview":
      await executeClonePreview(
        parseClonePreviewArguments()
      );
      return;

    default:
      printHelp();
      fail(`Unknown command: ${command}`, 2);
  }
}

await main();
