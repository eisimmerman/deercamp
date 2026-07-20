import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const functionsDir = dirname(scriptDir);
const sourceDir = join(functionsDir, "runtime-src");
const outputDir = join(functionsDir, "lib");

const requiredFiles = [
  "index.js",
  "steward-welcome-email.js",
];

for (const filename of requiredFiles) {
  const sourcePath = join(sourceDir, filename);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required runtime source: ${sourcePath}`);
  }
}

rmSync(outputDir, {
  recursive: true,
  force: true,
});

mkdirSync(outputDir, {
  recursive: true,
});

for (const filename of requiredFiles) {
  copyFileSync(
    join(sourceDir, filename),
    join(outputDir, filename),
  );
}

console.log(
  `Generated functions/lib from ${requiredFiles.length} tracked runtime source files.`,
);
