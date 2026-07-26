import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findTopLevelCampReferences,
  initializeFirestore,
  listTopLevelCollections
} from "../lib/firestore.mjs";

import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

import {
  serializeDocumentSnapshot
} from "../lib/serialization.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultBackupDirectory = path.resolve(
  moduleDirectory,
  "..",
  "backups"
);

function makeTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

async function readDocumentTree(documentRef) {
  const snapshot = await documentRef.get();
  const serialized = serializeDocumentSnapshot(snapshot);
  const subcollections = [];

  if (!snapshot.exists) {
    return {
      ...serialized,
      subcollections
    };
  }

  const collectionRefs = await documentRef.listCollections();
  collectionRefs.sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  for (const collectionRef of collectionRefs) {
    const collectionSnapshot = await collectionRef.get();
    const documents = [];

    for (const childSnapshot of collectionSnapshot.docs) {
      documents.push(
        await readDocumentTree(childSnapshot.ref)
      );
    }

    subcollections.push({
      id: collectionRef.id,
      path: collectionRef.path,
      documentCount: documents.length,
      documents
    });
  }

  return {
    ...serialized,
    subcollections
  };
}

export async function runBackup({
  campId,
  projectId,
  outputDirectory = defaultBackupDirectory
}) {
  const {
    db,
    projectId: resolvedProjectId
  } = initializeFirestore(projectId);

  printTitle("DeerCamp Firestore Camp Backup");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Camp:", campId);

  const campRef = db.collection("camps").doc(campId);
  const campSnapshot = await campRef.get();

  if (!campSnapshot.exists) {
    throw new Error(
      `Camp document does not exist: camps/${campId}`
    );
  }

  printSection("READING CAMP DOCUMENT TREE");
  const campTree = await readDocumentTree(campRef);
  console.log(`Captured ${campTree.path}`);

  printSection("READING TOP-LEVEL CAMP REFERENCES");

  const topLevelCollections = await listTopLevelCollections(db);
  const { references, skipped } =
    await findTopLevelCampReferences(
      db,
      campId,
      topLevelCollections
    );

  const referencedDocuments = [];

  for (const referencePath of references) {
    const snapshot = await db.doc(referencePath).get();
    referencedDocuments.push(
      serializeDocumentSnapshot(snapshot)
    );
    console.log(`Captured ${referencePath}`);
  }

  const createdAt = new Date();
  const backup = {
    format: "deercamp-camp-backup",
    formatVersion: 1,
    campOpsVersion: "0.5.0",
    createdAt: createdAt.toISOString(),
    projectId: resolvedProjectId,
    campId,
    sourceCampPath: campRef.path,
    safety: {
      readOnlyOperation: true,
      firestoreWritesPerformed: 0
    },
    counts: {
      topLevelReferences: referencedDocuments.length,
      skippedCollections: skipped.length
    },
    campTree,
    referencedDocuments,
    skippedCollections: skipped
  };

  await fs.mkdir(outputDirectory, { recursive: true });

  const filename =
    `${campId}-backup-${makeTimestamp(createdAt)}.json`;
  const outputPath = path.join(outputDirectory, filename);

  const serializedBackup = `${JSON.stringify(backup, null, 2)}\n`;

  await fs.writeFile(
    outputPath,
    serializedBackup,
    "utf8"
  );

  printSection("BACKUP COMPLETE");
  printKeyValue("File:", outputPath);
  printKeyValue(
    "Bytes:",
    Buffer.byteLength(serializedBackup, "utf8")
  );
  printKeyValue(
    "References:",
    referencedDocuments.length
  );
  printKeyValue(
    "Skipped:",
    skipped.length
  );

  blankLine();
  console.log("No Firestore data was changed.");

  return {
    backup,
    outputPath
  };
}

export async function executeBackup(options) {
  try {
    await runBackup(options);
  } catch (error) {
    printError("BACKUP FAILED", error);
    process.exitCode = 1;
  }
}
