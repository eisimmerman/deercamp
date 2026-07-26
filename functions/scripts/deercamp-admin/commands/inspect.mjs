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

async function inspectDocumentTree(documentRef, indent = "") {
  const snapshot = await documentRef.get();

  console.log(`${indent}Document: ${documentRef.path}`);
  console.log(`${indent}Exists:   ${snapshot.exists}`);

  if (!snapshot.exists) return;

  const fields = Object.keys(snapshot.data() || {}).sort();
  console.log(`${indent}Fields:   ${fields.join(", ") || "(none)"}`);

  const subcollections = await documentRef.listCollections();
  if (!subcollections.length) {
    console.log(`${indent}Subcollections: (none)`);
    return;
  }

  for (const collectionRef of subcollections) {
    const collectionSnapshot = await collectionRef.get();
    console.log(
      `${indent}Collection: ${collectionRef.path} - ` +
      `${collectionSnapshot.size} document(s)`
    );
    for (const childDocument of collectionSnapshot.docs) {
      await inspectDocumentTree(childDocument.ref, `${indent}  `);
    }
  }
}

export async function runInspect({ campId, projectId }) {
  const { db, projectId: resolvedProjectId } =
    initializeFirestore(projectId);

  printTitle("DeerCamp Firestore Camp Inspector");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Camp:", campId);

  const topLevelCollections = await listTopLevelCollections(db);

  printSection("TOP-LEVEL COLLECTIONS");
  for (const collectionRef of topLevelCollections) {
    console.log(collectionRef.id);
  }

  printSection("CAMP DOCUMENT TREE");
  await inspectDocumentTree(db.collection("camps").doc(campId));

  printSection(`TOP-LEVEL DOCUMENTS REFERENCING campId = "${campId}"`);
  const { references, skipped } =
    await findTopLevelCampReferences(db, campId, topLevelCollections);

  console.log(references.length ? references.join("\n") : "(none)");
  if (skipped.length) {
    printSection("SKIPPED COLLECTIONS");
    for (const item of skipped) {
      console.log(`[${item.collectionId}] ${item.message}`);
    }
  }

  blankLine();
  console.log("Inspection complete. No Firestore data was changed.");
}

export async function executeInspect(options) {
  try {
    await runInspect(options);
  } catch (error) {
    printError("INSPECTION FAILED", error);
    process.exitCode = 1;
  }
}
