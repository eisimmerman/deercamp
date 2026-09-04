import { initializeFirestore } from "../lib/firestore.mjs";

function clean(value) {
  return String(value || "").trim();
}

export async function executeOwnershipAudit({ projectId }) {
  const {
    db,
    projectId: resolvedProjectId
  } = initializeFirestore(projectId);

  console.log("");
  console.log("============================================================");
  console.log("DEERCAMP TRUSTED OWNERSHIP AUDIT");
  console.log("============================================================");
  console.log(`Project: ${resolvedProjectId}`);
  console.log("Mode: READ ONLY");
  console.log("");

  const [campsSnap, accessSnap] = await Promise.all([
    db.collection("camps").get(),
    db.collection("campAccess").get()
  ]);

  const accessByCampId = new Map(
    accessSnap.docs.map(doc => [doc.id, doc.data() || {}])
  );

  const rows = [];
  const counts = {
    OK: 0,
    MISSING_ACCESS: 0,
    MISSING_OWNER: 0,
    UID_MISMATCH: 0,
    LEGACY_UNASSIGNED: 0
  };

  for (const campDoc of campsSnap.docs) {
    const campId = campDoc.id;
    const camp = campDoc.data() || {};
    const access = accessByCampId.get(campId) || null;

    const trustedOwnerUid = clean(camp.trustedOwnerUid);
    const stewardUid = clean(access?.stewardUid);
    const stewardEmail = clean(
      access?.stewardEmail ||
      camp.stewardEmail ||
      camp.campStewardEmail
    );

    let status;

    if (!trustedOwnerUid && !access) {
      status = "LEGACY_UNASSIGNED";
    } else if (trustedOwnerUid && !access) {
      status = "MISSING_ACCESS";
    } else if (!trustedOwnerUid && stewardUid) {
      status = "MISSING_OWNER";
    } else if (
      trustedOwnerUid &&
      stewardUid &&
      trustedOwnerUid !== stewardUid
    ) {
      status = "UID_MISMATCH";
    } else if (
      trustedOwnerUid &&
      stewardUid &&
      trustedOwnerUid === stewardUid
    ) {
      status = "OK";
    } else {
      status = "LEGACY_UNASSIGNED";
    }

    counts[status] += 1;

    rows.push({
      status,
      campId,
      trustedOwnerUid: trustedOwnerUid || "-",
      stewardUid: stewardUid || "-",
      stewardEmail: stewardEmail || "-"
    });
  }

  rows.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status.localeCompare(b.status);
    }
    return a.campId.localeCompare(b.campId);
  });

  for (const row of rows) {
    console.log(
      [
        row.status.padEnd(18),
        row.campId.padEnd(48),
        `owner=${row.trustedOwnerUid}`,
        `steward=${row.stewardUid}`,
        `email=${row.stewardEmail}`
      ].join("  ")
    );
  }

  const orphanAccess = accessSnap.docs
    .filter(doc => !campsSnap.docs.some(camp => camp.id === doc.id))
    .map(doc => ({
      campId: doc.id,
      stewardUid: clean(doc.data()?.stewardUid) || "-",
      stewardEmail: clean(doc.data()?.stewardEmail) || "-"
    }));

  console.log("");
  console.log("============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  console.log(`Camps:             ${campsSnap.size}`);
  console.log(`campAccess docs:   ${accessSnap.size}`);
  console.log(`OK:                ${counts.OK}`);
  console.log(`MISSING_ACCESS:    ${counts.MISSING_ACCESS}`);
  console.log(`MISSING_OWNER:     ${counts.MISSING_OWNER}`);
  console.log(`UID_MISMATCH:      ${counts.UID_MISMATCH}`);
  console.log(`LEGACY_UNASSIGNED: ${counts.LEGACY_UNASSIGNED}`);
  console.log(`ORPHAN_ACCESS:     ${orphanAccess.length}`);

  if (orphanAccess.length) {
    console.log("");
    console.log("ORPHAN campAccess DOCUMENTS");
    orphanAccess.forEach(row => {
      console.log(
        `${row.campId}  steward=${row.stewardUid}  email=${row.stewardEmail}`
      );
    });
  }

  console.log("");
  console.log("READ-ONLY AUDIT COMPLETE.");
}
