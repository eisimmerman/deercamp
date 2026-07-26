import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultLogDirectory = path.resolve(
  moduleDirectory,
  "..",
  "logs"
);

function timestampForFilename(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export async function writeOperationLog(operation, directory = defaultLogDirectory) {
  await fs.mkdir(directory, { recursive: true });

  const startedAt = new Date(operation.startedAt);
  const filename =
    `${operation.operation}-${operation.sourceCampId}-to-` +
    `${operation.targetCampId}-${timestampForFilename(startedAt)}.json`;

  const filePath = path.join(directory, filename);
  await fs.writeFile(
    filePath,
    `${JSON.stringify(operation, null, 2)}\n`,
    "utf8"
  );

  return filePath;
}
