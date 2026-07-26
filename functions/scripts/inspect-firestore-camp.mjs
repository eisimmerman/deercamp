import admin from "firebase-admin";

const projectId = process.argv[2] || "deercamp-47c12";
const campId = process.argv[3] || "camp-swede";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId
});

const db = admin.firestore();

async function inspectDocumentTree(documentRef, indent = "") {
  const snapshot = await documentRef.get();

  console.log(`${indent}Document: ${documentRef.path}`);
  console.log(`${indent}Exists:   ${snapshot.exists}`);

  if (!snapshot.exists) {
    return;
  }

  const data = snapshot.data() || {};

  console.log(
    `${indent}Fields:   ${Object.keys(data).sort().join(", ") || "(none)"}`
  );

  const subcollections = await documentRef.listCollections();

  if (!subcollections.length) {
    console.log(`${indent}Subcollections: (none)`);
    return;
  }

  console.log(
    `${indent}Subcollections: ${subcollections
      .map((collection) => collection.id)
      .join(", ")}`
  );

  for (const collectionRef of subcollections) {
    const collectionSnapshot = await collectionRef.get();

    console.log(
      `${indent}  Collection: ${collectionRef.path} — ${collectionSnapshot.size} document(s)`
    );

    for (const childDocument of collectionSnapshot.docs) {
      await inspectDocumentTree(childDocument.ref, `${indent}    `);
    }
  }
}

async function main() {
  console.log("");
  console.log("DeerCamp Firestore Camp Inspector");
  console.log("=================================");
  console.log(`Project: ${projectId}`);
  console.log(`Camp:    ${campId}`);
  console.log("");

  const topLevelCollections = await db.listCollections();

  console.log("TOP-LEVEL COLLECTIONS");
  console.log("---------------------");

  for (const collectionRef of topLevelCollections) {
    console.log(collectionRef.id);
  }

  console.log("");
  console.log("CAMP DOCUMENT TREE");
  console.log("------------------");

  const campRef = db.collection("camps").doc(campId);
  await inspectDocumentTree(campRef);

  console.log("");
  console.log(`TOP-LEVEL DOCUMENTS REFERENCING campId = "${campId}"`);
  console.log("----------------------------------------------------");

  let referenceCount = 0;

  for (const collectionRef of topLevelCollections) {
    try {
      const snapshot = await collectionRef
        .where("campId", "==", campId)
        .get();

      for (const documentSnapshot of snapshot.docs) {
        console.log(documentSnapshot.ref.path);
        referenceCount += 1;
      }
    } catch (error) {
      console.log(
        `[Skipped ${collectionRef.id}: ${error?.message || String(error)}]`
      );
    }
  }

  if (referenceCount === 0) {
    console.log("(No matching top-level documents found.)");
  }

  console.log("");
  console.log("Inspection complete. No Firestore data was changed.");
}

main().catch((error) => {
  console.error("");
  console.error("INSPECTION FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});