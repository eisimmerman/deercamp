export function blankLine() {
  console.log("");
}

export function printTitle(title) {
  blankLine();
  console.log(title);
  console.log("=".repeat(title.length));
}

export function printSection(title) {
  blankLine();
  console.log(title);
  console.log("-".repeat(title.length));
}

export function printKeyValue(label, value, width = 8) {
  console.log(`${String(label).padEnd(width)}${value}`);
}

export function printError(title, error) {
  console.error("");
  console.error(title);
  console.error(error?.stack || error?.message || String(error));
}

export function fail(message, exitCode = 1) {
  console.error("");
  console.error(`ERROR: ${message}`);
  console.error("");
  process.exit(exitCode);
}
