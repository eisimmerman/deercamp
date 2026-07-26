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

function safePart(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function writeOperationLog(
  operation,
  directory = defaultLogDirectory
) {
  await fs.mkdir(directory, { recursive: true });

  const startedAt = new Date(operation.startedAt);
  const filename =
    `${safePart(operation.operation)}-` +
    `${safePart(operation.sourceCampId)}-to-` +
    `${safePart(operation.targetCampId)}-` +
    `${timestampForFilename(startedAt)}.json`;

  const filePath = path.join(directory, filename);
  await fs.writeFile(
    filePath,
    `${JSON.stringify(operation, null, 2)}\n`,
    "utf8"
  );

  return filePath;
}
