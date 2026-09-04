#!/usr/bin/env node

import { executeBackup } from "./commands/backup.mjs";
import { executeClone } from "./commands/clone.mjs";
import { executeClonePreview } from "./commands/clone-preview.mjs";
import { executeCompare } from "./commands/compare.mjs";
import { executeDelete } from "./commands/delete.mjs";
import { executeDeletePreview } from "./commands/delete-preview.mjs";
import { executeInspect } from "./commands/inspect.mjs";
import { executeOwnershipAudit } from "./commands/ownership-audit.mjs";
import { executeRestore } from "./commands/restore.mjs";
import { executeRestorePreview } from "./commands/restore-preview.mjs";
import { DEFAULT_PROJECT_ID } from "./lib/firestore.mjs";
import { fail, printTitle } from "./lib/output.mjs";

export const VERSION = "0.8.0";

const args = process.argv.slice(2);
const command = String(args[0] || "help").trim().toLowerCase();

function getOption(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

function resolveProjectId(positionalIndex) {
  return (
    String(
      getOption("--project") ||
      args[positionalIndex] ||
      DEFAULT_PROJECT_ID
    ).trim() || DEFAULT_PROJECT_ID
  );
}

function printHelp() {
  printTitle(`CampOps v${VERSION}`);
  console.log("");
  console.log("Commands:");
  console.log("  help");
  console.log("  version");
  console.log("  inspect <campId> [projectId]");
  console.log("  ownership-audit [projectId]");
  console.log("  backup <campId> [projectId]");
  console.log("  compare <leftCampId> <rightCampId> [projectId]");
  console.log(
    "  clone-preview <sourceCampId> <targetCampId> [projectId]"
  );
  console.log(
    "  clone <sourceCampId> <targetCampId> " +
    "--project deercamp-47c12 --execute"
  );
  console.log(
    "  restore-preview <backupFile> <targetCampId> [projectId]"
  );
  console.log(
    "  restore <backupFile> <targetCampId> " +
    "--project deercamp-47c12 --execute"
  );
  console.log("  delete-preview <campId> [projectId]");
  console.log(
    "  delete <campId> --project deercamp-47c12 --execute"
  );
  console.log("");
  console.log("Restore v0.7 behavior:");
  console.log("  - Creates missing documents");
  console.log("  - Replaces planned documents");
  console.log("  - Does not delete extra target documents");
  console.log("  - Backs up an existing target before writing");
  console.log("  - Requires exact target-ID confirmation");
  console.log("  - Verifies expected documents exist");
  console.log("  - Writes a JSON operation log");
  console.log("");
  console.log("Delete v0.8 behavior:");
  console.log("  - Blocks protected camp IDs with no CLI override");
  console.log("  - Creates an automatic backup before deletion");
  console.log("  - Requires --execute and exact confirmation");
  console.log("  - Deletes related docs, descendants, then root");
  console.log("  - Verifies expected documents are absent");
  console.log("  - Writes a JSON operation log");
}

function parseCampCommandArguments(commandName) {
  const campId = String(args[1] || "").trim();
  if (!campId) fail(`Missing camp ID for ${commandName}.`);
  return { campId, projectId: resolveProjectId(2) };
}

function parseCompareArguments() {
  const leftCampId = String(args[1] || "").trim();
  const rightCampId = String(args[2] || "").trim();
  if (!leftCampId || !rightCampId) {
    fail("Compare requires two camp IDs.");
  }
  return {
    leftCampId,
    rightCampId,
    projectId: resolveProjectId(3)
  };
}

function parseCloneArguments(includeExecute = false) {
  const sourceCampId = String(args[1] || "").trim();
  const targetCampId = String(args[2] || "").trim();
  if (!sourceCampId || !targetCampId) {
    fail("Clone requires source and target camp IDs.");
  }

  return {
    sourceCampId,
    targetCampId,
    projectId: resolveProjectId(3),
    ...(includeExecute ? { execute: hasFlag("--execute") } : {})
  };
}

function parseRestoreArguments(includeExecute = false) {
  const backupFile = String(args[1] || "").trim();
  const targetCampId = String(args[2] || "").trim();

  if (!backupFile || !targetCampId) {
    fail("Restore requires a backup file and target camp ID.");
  }

  return {
    backupFile,
    targetCampId,
    projectId: resolveProjectId(3),
    ...(includeExecute ? { execute: hasFlag("--execute") } : {})
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
      await executeInspect(parseCampCommandArguments("inspect"));
      return;
    case "ownership-audit":
      await executeOwnershipAudit({
        projectId: resolveProjectId(1)
      });
      return;
    case "backup":
      await executeBackup(parseCampCommandArguments("backup"));
      return;
    case "compare":
      await executeCompare(parseCompareArguments());
      return;
    case "clone-preview":
      await executeClonePreview(parseCloneArguments(false));
      return;
    case "clone":
      await executeClone(parseCloneArguments(true));
      return;
    case "restore-preview":
      await executeRestorePreview(parseRestoreArguments(false));
      return;
    case "delete-preview":
      await executeDeletePreview(
        parseCampCommandArguments("delete-preview")
      );
      return;
    case "restore":
      await executeRestore(parseRestoreArguments(true));
      return;
    case "delete": {
      const parsed = parseCampCommandArguments("delete");
      await executeDelete({
        ...parsed,
        execute: hasFlag("--execute")
      });
      return;
    }
    default:
      printHelp();
      fail(`Unknown command: ${command}`, 2);
  }
}

await main();
