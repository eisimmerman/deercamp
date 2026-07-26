export async function summarizeDocumentTree(documentRef) {
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return {
      exists: false,
      documentCount: 0,
      subcollectionCount: 0,
      documentPaths: []
    };
  }

  const summary = {
    exists: true,
    documentCount: 1,
    subcollectionCount: 0,
    documentPaths: [documentRef.path]
  };

  const subcollections = await documentRef.listCollections();
  subcollections.sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  summary.subcollectionCount += subcollections.length;

  for (const collectionRef of subcollections) {
    const collectionSnapshot = await collectionRef.get();

    for (const childSnapshot of collectionSnapshot.docs) {
      const childSummary =
        await summarizeDocumentTree(childSnapshot.ref);

      summary.documentCount += childSummary.documentCount;
      summary.subcollectionCount +=
        childSummary.subcollectionCount;
      summary.documentPaths.push(
        ...childSummary.documentPaths
      );
    }
  }

  return summary;
}
