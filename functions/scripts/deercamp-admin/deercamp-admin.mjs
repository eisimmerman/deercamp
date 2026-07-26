#!/usr/bin/env node

import { executeBackup } from "./commands/backup.mjs";
import { executeClone } from "./commands/clone.mjs";
import { executeClonePreview } from "./commands/clone-preview.mjs";
import { executeCompare } from "./commands/compare.mjs";
import { executeInspect } from "./commands/inspect.mjs";
import { DEFAULT_PROJECT_ID } from "./lib/firestore.mjs";
import { fail, printTitle } from "./lib/output.mjs";

export const VERSION = "0.6.0";

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
    String(getOption("--project") || args[positionalIndex] || DEFAULT_PROJECT_ID).trim()
    || DEFAULT_PROJECT_ID
  );
}

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
  console.log("  version");
  console.log("  inspect <campId> [projectId]");
  console.log("  backup <campId> [projectId]");
  console.log("  compare <leftCampId> <rightCampId> [projectId]");
  console.log(
    "  clone-preview <sourceCampId> <targetCampId> [projectId]"
  );
  console.log(
    "  clone <sourceCampId> <targetCampId> --project deercamp-47c12 --execute"
  );
  console.log("");
  console.log("Clone safety:");
  console.log("  - Production project allow-list");
  console.log("  - Source exists and target does not");
  console.log("  - Automatic source backup");
  console.log("  - --execute required");
  console.log("  - Exact interactive target-ID confirmation");
  console.log("  - No-overwrite preflight");
  console.log("  - Post-write verification");
  console.log("  - JSON operation log");
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
    default:
      printHelp();
      fail(`Unknown command: ${command}`, 2);
  }
}

await main();
