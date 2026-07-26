import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const command = String(args[0] || "help").trim().toLowerCase();

const DEFAULT_PROJECT_ID = "deercamp-47c12";

function printHeader() {
  console.log("");
  console.log("DeerCamp Admin Toolkit");
  console.log("======================");
}

function printHelp() {
  printHeader();
  console.log("");
  console.log("Usage:");
  console.log("  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs <command> [arguments]");
  console.log("");
  console.log("Commands:");
  console.log("  help");
  console.log("      Show this help screen.");
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
  console.log("  Inspect -> Backup -> Dry run -> Exact confirmation -> Write -> Verify");
  console.log("");
}

function fail(message, exitCode = 1) {
  console.error("");
  console.error("ERROR: " + message);
  console.error("");
  process.exit(exitCode);
}

function runInspect() {
  const campId = String(args[1] || "").trim();
  const projectId = String(args[2] || DEFAULT_PROJECT_ID).trim();

  if (!campId) {
    fail(
      "Missing camp ID.\n\n" +
      "Example:\n" +
      "  node .\\scripts\\deercamp-admin\\deercamp-admin.mjs inspect " +
      "camp-boddington-independence-ks-67301"
    );
  }

  const inspectorPath = path.join(
    __dirname,
    "inspect-firestore-camp-original.mjs"
  );

  const result = spawnSync(
    process.execPath,
    [inspectorPath, projectId, campId],
    {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: false
    }
  );

  if (result.error) {
    fail(result.error.message);
  }

  process.exit(
    typeof result.status === "number"
      ? result.status
      : 1
  );
}

switch (command) {
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;

  case "inspect":
    runInspect();
    break;

  default:
    printHelp();
    fail(`Unknown command: ${command}`, 2);
}
