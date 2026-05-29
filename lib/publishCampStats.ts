// lib/publishCampStats.ts
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { auth, db } from "./firebase";
import {
  getPendingCampStats,
  markLocalCampStatSyncStatus,
  type LocalCampStatRecord,
} from "./localCampStats";

export type CampStatsSyncResult = {
  attempted: number;
  synced: number;
  failed: number;
  skippedReason?: "not-signed-in" | "no-pending-records";
};

function requireSignedInUser() {
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    return null;
  }

  return user;
}

function toFirestorePayload(record: LocalCampStatRecord, userId: string) {
  return {
    localId: record.id,
    campId: record.campId,
    campName: record.campName || "",
    standId: record.standId,
    standName: record.standName,
    statType: record.statType,
    statLabel: record.statLabel,
    count: record.count,
    clientCreatedAt: record.clientCreatedAt,
    clientCreatedAtIso: new Date(record.clientCreatedAt).toISOString(),
    authorId: record.authorId || userId,
    authorName: record.authorName || "DeerCamp Member",
    uploadedBy: userId,
    source: "CampStatsMgr",
    schemaVersion: 1,
    createdAt: serverTimestamp(),
  };
}

export async function publishCampStatRecord(record: LocalCampStatRecord) {
  const user = requireSignedInUser();

  if (!user) {
    throw new Error("Sign in to sync CampStatsMgr records.");
  }

  await markLocalCampStatSyncStatus(record.id, "syncing");

  try {
    const campId = record.campId || "unknown-camp";
    const docRef = await addDoc(
      collection(db, "camps", campId, "campStats"),
      toFirestorePayload(record, user.uid)
    );

    await markLocalCampStatSyncStatus(record.id, "synced", {
      firestoreDocId: docRef.id,
      syncedAt: Date.now(),
      syncError: undefined,
    });

    return docRef.id;
  } catch (error: any) {
    await markLocalCampStatSyncStatus(record.id, "failed", {
      syncError: error?.message || "CampStatsMgr sync failed.",
    });

    throw error;
  }
}

export async function syncPendingCampStats(campId?: string): Promise<CampStatsSyncResult> {
  const user = requireSignedInUser();

  if (!user) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skippedReason: "not-signed-in",
    };
  }

  const pendingRecords = await getPendingCampStats(campId);

  if (!pendingRecords.length) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skippedReason: "no-pending-records",
    };
  }

  let synced = 0;
  let failed = 0;

  for (const record of pendingRecords) {
    try {
      await publishCampStatRecord({
        ...record,
        authorId: record.authorId === "anonymous" ? user.uid : record.authorId,
        authorName:
          record.authorName && record.authorName !== "DeerCamp Member"
            ? record.authorName
            : user.displayName?.trim() || user.email?.trim() || "DeerCamp Member",
      });
      synced += 1;
    } catch (error) {
      console.error("CampStatsMgr sync failed:", error);
      failed += 1;
    }
  }

  return {
    attempted: pendingRecords.length,
    synced,
    failed,
  };
}
