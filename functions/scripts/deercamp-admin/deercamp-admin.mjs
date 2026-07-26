#!/usr/bin/env node

import { executeInspect } from "./commands/inspect.mjs";
import { DEFAULT_PROJECT_ID } from "./lib/firestore.mjs";
import { fail, printTitle } from "./lib/output.mjs";

export const VERSION = "0.2.0";

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
  console.log("      Inspect a camp document, nested subcollections, and");
  console.log("      top-level Firestore records that reference the camp ID.");

  console.log("");
  console.log("Planned commands:");
  console.log("  list       Search and summarize camps");
  console.log("  backup     Export a complete camp backup");
  console.log("  compare    Compare two camps");
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

    case "inspect": {
      const campId = String(args[1] || "").trim();
      const projectId =
        String(args[2] || DEFAULT_PROJECT_ID).trim() ||
        DEFAULT_PROJECT_ID;

      if (!campId) {
        fail(
          "Missing camp ID.\n\n" +
          "Example:\n" +
          "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs " +
          "inspect camp-boddington-independence-ks-67301"
        );
      }

      await executeInspect({
        campId,
        projectId
      });
      return;
    }

    default:
      printHelp();
      fail(`Unknown command: ${command}`, 2);
  }
}

await main();
