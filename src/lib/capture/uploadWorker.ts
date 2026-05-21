// src/lib/capture/uploadWorker.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  getPendingUploadQueueItems,
  markUploadItemFailed,
  markUploadItemUploaded,
  markUploadItemUploading,
} from "@/lib/capture/uploadQueue";

let uploadWorkerRunning = false;

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(`Could not read local file for upload: ${response.status}`);
  }

  return response.blob();
}

function getStoragePath(params: {
  authorId?: string;
  memoryId: string;
  segmentId: string;
  mediaType: "audio" | "video" | "photo";
}) {
  const authorId = params.authorId || "unknown-author";
  const extension =
    params.mediaType === "photo"
      ? "jpg"
      : params.mediaType === "video"
        ? "mp4"
        : "m4a";

  return `fieldMemories/${authorId}/${params.memoryId}/segments/${params.segmentId}.${extension}`;
}

export async function processUploadQueueOnce(limit = 3) {
  if (uploadWorkerRunning) {
    return [];
  }

  uploadWorkerRunning = true;

  try {
    const pending = await getPendingUploadQueueItems();
    const items = pending.slice(0, limit);

    const results = [];

    for (const item of items) {
      try {
        await markUploadItemUploading(item.id);

        const blob = await uriToBlob(item.uri);

        const storagePath = getStoragePath({
          authorId: item.authorId,
          memoryId: item.memoryId,
          segmentId: item.segmentId,
          mediaType: item.mediaType,
        });

        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, blob, {
          contentType:
            item.mediaType === "photo"
              ? "image/jpeg"
              : item.mediaType === "video"
                ? "video/mp4"
                : "audio/mp4",
          customMetadata: {
            memoryId: item.memoryId,
            segmentId: item.segmentId,
            segmentIndex: String(item.segmentIndex),
            authorId: item.authorId || "",
          },
        });

        const uploadedUrl = await getDownloadURL(storageRef);

        await markUploadItemUploaded(item.id, uploadedUrl);

        results.push({
          id: item.id,
          status: "uploaded",
          uploadedUrl,
        });
      } catch (error: any) {
        const message =
          error?.message || error?.code || "Segment upload failed.";

        console.error("upload queue item failed:", item.id, message);

        await markUploadItemFailed(item.id, message);

        results.push({
          id: item.id,
          status: "failed",
          error: message,
        });
      }
    }

    return results;
  } finally {
    uploadWorkerRunning = false;
  }
}