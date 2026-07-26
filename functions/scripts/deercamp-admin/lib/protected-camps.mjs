import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = path.resolve(
  moduleDirectory,
  "..",
  "config",
  "protected-camps.json"
);

export async function readProtectedCampIds(
  configPath = defaultConfigPath
) {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const ids = Array.isArray(parsed?.protectedCampIds)
    ? parsed.protectedCampIds
    : [];

  return {
    configPath,
    protectedCampIds: new Set(
      ids.map((value) => String(value).trim()).filter(Boolean)
    )
  };
}

export async function assertCampNotProtected(campId) {
  const { configPath, protectedCampIds } =
    await readProtectedCampIds();

  if (protectedCampIds.has(campId)) {
    throw new Error(
      `Camp "${campId}" is protected and cannot be deleted.\n` +
      `Protected-camp configuration: ${configPath}\n` +
      "There is no command-line override."
    );
  }

  return { configPath, protectedCampIds };
}
