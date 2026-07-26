import {
  findTopLevelCampReferences,
  initializeFirestore,
  listTopLevelCollections
} from "../lib/firestore.mjs";

import { compareObjects } from "../lib/compare.mjs";

import {
  blankLine,
  printError,
  printKeyValue,
  printSection,
  printTitle
} from "../lib/output.mjs";

function printFieldList(title, fields) {
  printSection(title);

  if (!fields.length) {
    console.log("(none)");
    return;
  }

  for (const field of fields) {
    console.log(field);
  }
}

function printChangedFields(changed) {
  printSection("CHANGED FIELDS");

  if (!changed.length) {
    console.log("(none)");
    return;
  }

  for (const item of changed) {
    console.log(item.field);
    console.log(`  Left:  ${JSON.stringify(item.left)}`);
    console.log(`  Right: ${JSON.stringify(item.right)}`);
  }
}

export async function runCompare({
  leftCampId,
  rightCampId,
  projectId
}) {
  const {
    db,
    projectId: resolvedProjectId
  } = initializeFirestore(projectId);

  printTitle("DeerCamp Firestore Camp Compare");
  printKeyValue("Project:", resolvedProjectId);
  printKeyValue("Left camp:", leftCampId);
  printKeyValue("Right camp:", rightCampId);

  const leftSnapshot = await db
    .collection("camps")
    .doc(leftCampId)
    .get();

  const rightSnapshot = await db
    .collection("camps")
    .doc(rightCampId)
    .get();

  if (!leftSnapshot.exists) {
    throw new Error(
      `Left camp does not exist: camps/${leftCampId}`
    );
  }

  if (!rightSnapshot.exists) {
    throw new Error(
      `Right camp does not exist: camps/${rightCampId}`
    );
  }

  const comparison = compareObjects(
    leftSnapshot.data() || {},
    rightSnapshot.data() || {}
  );

  printSection("SUMMARY");
  printKeyValue("Matching:", comparison.matching.length);
  printKeyValue("Changed:", comparison.changed.length);
  printKeyValue("Left only:", comparison.onlyLeft.length);
  printKeyValue("Right only:", comparison.onlyRight.length);

  printFieldList(
    `ONLY IN LEFT CAMP (${leftCampId})`,
    comparison.onlyLeft
  );

  printFieldList(
    `ONLY IN RIGHT CAMP (${rightCampId})`,
    comparison.onlyRight
  );

  printChangedFields(comparison.changed);

  printSection("TOP-LEVEL REFERENCE COUNTS");

  const collections = await listTopLevelCollections(db);

  const leftReferences =
    await findTopLevelCampReferences(
      db,
      leftCampId,
      collections
    );

  const rightReferences =
    await findTopLevelCampReferences(
      db,
      rightCampId,
      collections
    );

  printKeyValue(
    "Left refs:",
    leftReferences.references.length
  );
  printKeyValue(
    "Right refs:",
    rightReferences.references.length
  );
  printKeyValue(
    "Left skipped:",
    leftReferences.skipped.length
  );
  printKeyValue(
    "Right skipped:",
    rightReferences.skipped.length
  );

  blankLine();
  console.log("Comparison complete. No Firestore data was changed.");
}

export async function executeCompare(options) {
  try {
    await runCompare(options);
  } catch (error) {
    printError("COMPARE FAILED", error);
    process.exitCode = 1;
  }
}
