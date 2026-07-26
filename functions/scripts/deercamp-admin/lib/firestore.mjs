import admin from "firebase-admin";

export const DEFAULT_PROJECT_ID = "deercamp-47c12";

export function initializeFirestore(projectId = DEFAULT_PROJECT_ID) {
  const resolvedProjectId =
    String(projectId || DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;

  const app =
    admin.apps.length > 0
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: resolvedProjectId
        });

  return {
    admin,
    app,
    db: app.firestore(),
    projectId: resolvedProjectId
  };
}

export async function listTopLevelCollections(db) {
  const collections = await db.listCollections();

  return collections.sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

export async function findTopLevelCampReferences(
  db,
  campId,
  collections = null
) {
  const topLevelCollections =
    collections || (await listTopLevelCollections(db));

  const references = [];
  const skipped = [];

  for (const collectionRef of topLevelCollections) {
    try {
      const snapshot = await collectionRef
        .where("campId", "==", campId)
        .get();

      for (const documentSnapshot of snapshot.docs) {
        references.push(documentSnapshot.ref.path);
      }
    } catch (error) {
      skipped.push({
        collectionId: collectionRef.id,
        message: error?.message || String(error)
      });
    }
  }

  references.sort((left, right) => left.localeCompare(right));

  return {
    references,
    skipped
  };
}
