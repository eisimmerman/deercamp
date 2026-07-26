export async function collectDocumentTree(documentRef) {
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return [];
  }

  const documents = [{
    path: documentRef.path,
    data: snapshot.data() || {}
  }];

  const subcollections = await documentRef.listCollections();
  subcollections.sort((left, right) => left.id.localeCompare(right.id));

  for (const collectionRef of subcollections) {
    const collectionSnapshot = await collectionRef.get();

    for (const childSnapshot of collectionSnapshot.docs) {
      documents.push(
        ...(await collectDocumentTree(childSnapshot.ref))
      );
    }
  }

  return documents;
}

export async function summarizeDocumentTree(documentRef) {
  const documents = await collectDocumentTree(documentRef);
  const subcollectionPaths = new Set();

  for (const document of documents) {
    const segments = document.path.split("/");
    for (let index = 2; index < segments.length; index += 2) {
      subcollectionPaths.add(segments.slice(0, index + 1).join("/"));
    }
  }

  return {
    exists: documents.length > 0,
    documentCount: documents.length,
    subcollectionCount: subcollectionPaths.size,
    documentPaths: documents.map((item) => item.path)
  };
}

export function mapCampTreePath(sourcePath, sourceCampId, targetCampId) {
  const sourcePrefix = `camps/${sourceCampId}`;
  const targetPrefix = `camps/${targetCampId}`;

  if (!sourcePath.startsWith(sourcePrefix)) {
    throw new Error(`Unexpected source camp tree path: ${sourcePath}`);
  }

  return `${targetPrefix}${sourcePath.slice(sourcePrefix.length)}`;
}
