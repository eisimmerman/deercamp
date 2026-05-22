// src/lib/capture/uploadWorker.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { publishUploadedMemoryToFeed } from "@/lib/publishMemory";
import {
  getPendingUploadQueueItems,
  getUploadQueueItemsForMemory,
  markUploadItemFailed,
  markUploadItemUploaded,
  markUploadItemUploading,
  type UploadQueueItem,
} from "@/lib/capture/uploadQueue";
import {
  DEFAULT_ACTIVE_CAMP_ID,
  getActiveCampId,
  getLocalMemoryById,
  markMemoryPublished,
  updateLocalMemory,
  type LocalMemorySegment,
} from "@/lib/localMemories";

let uploadWorkerRunning = false;

async function uriToBlobWithXhr(uri: string): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onload = () => {
      const blob = xhr.response;

      if (!blob) {
        reject(new Error("Could not read local file: empty blob response."));
        return;
      }

      resolve(blob);
    };

    xhr.onerror = () => {
      reject(new Error("Could not read local file with XMLHttpRequest."));
    };

    xhr.ontimeout = () => {
      reject(new Error("Timed out while reading local file."));
    };

    xhr.responseType = "blob";
    xhr.timeout = 30000;
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

async function uriToBlobWithFetch(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(`Could not read local file for upload: ${response.status}`);
  }

  return response.blob();
}

async function uriToBlob(uri: string): Promise<Blob> {
  const cleanUri = String(uri || "").trim();

  if (!cleanUri) {
    throw new Error("Could not read local file for upload: missing URI.");
  }

  try {
    return await uriToBlobWithXhr(cleanUri);
  } catch (xhrError: any) {
    console.warn(
      "local file XMLHttpRequest read failed; trying fetch fallback:",
      xhrError?.message || xhrError
    );

    try {
      return await uriToBlobWithFetch(cleanUri);
    } catch (fetchError: any) {
      const xhrMessage = xhrError?.message || "XMLHttpRequest read failed.";
      const fetchMessage = fetchError?.message || "Fetch read failed.";

      throw new Error(
        `Could not read local file for upload. XHR: ${xhrMessage} Fetch: ${fetchMessage}`
      );
    }
  }
}

function getStoragePath(params: {
  authorId?: string;
  memoryId: string;
  segmentId: string;
  mediaType: "audio" | "video" | "photo";
}) {
  const authorId = params.authorId || "unknown-author";

  if (params.mediaType === "photo") {
    return `fieldMemories/${authorId}/${params.memoryId}/photos/${params.segmentId}.jpg`;
  }

  const extension = params.mediaType === "video" ? "mp4" : "m4a";
  return `fieldMemories/${authorId}/${params.memoryId}/segments/${params.segmentId}.${extension}`;
}

function getContentType(mediaType: "audio" | "video" | "photo") {
  if (mediaType === "photo") return "image/jpeg";
  if (mediaType === "video") return "video/mp4";
  return "audio/mp4";
}

async function publishMemoryToCampFeedIfReady(memoryId: string) {
  const memory = await getLocalMemoryById(memoryId);
  if (!memory) return;

  if (memory.feedDocId) {
    await updateLocalMemory(memoryId, {
      syncStatus: "synced",
      publishError: undefined,
    });
    return;
  }

  const activeCampId = await getActiveCampId();
  const campId = memory.campId || activeCampId || DEFAULT_ACTIVE_CAMP_ID;

  await updateLocalMemory(memoryId, {
    syncStatus: "publishing",
    campId,
    publishError: undefined,
  });

  const published = await publishUploadedMemoryToFeed(
    {
      ...memory,
      campId,
    },
    {
      campId,
      defaultTitle: memory.type === "photo" ? "Field Photo" : "Field Memory",
      defaultCaption:
        memory.type === "photo"
          ? "Photo captured in DeerCamp Field Mode."
          : "Photo + voice captured in DeerCamp Field Mode.",
    }
  );

  await markMemoryPublished(memoryId, {
    feedDocId: published.feedDocId,
    campId: published.campId,
    photoUrl: published.imageUrl,
    audioUrl: published.audioUrl,
    voiceUrl: published.audioUrl,
  });
}

async function updateMemoryUploadState(memoryId: string) {
  const items = await getUploadQueueItemsForMemory(memoryId);
  if (items.length === 0) return;

  const failedItems = items.filter((item) => item.status === "failed");
  const activeItems = items.filter(
    (item) => item.status === "pending" || item.status === "uploading"
  );
  const allUploaded = items.every((item) => item.status === "uploaded");

  if (allUploaded) {
    try {
      await publishMemoryToCampFeedIfReady(memoryId);
    } catch (error: any) {
      const message =
        error?.message || error?.code || "CampFeed publish failed.";

      console.error("publish uploaded memory to feed failed:", memoryId, message);

      await updateLocalMemory(memoryId, {
        syncStatus: "failed",
        publishError: String(message || "CampFeed publish failed.").trim(),
      });
    }
    return;
  }

  if (failedItems.length > 0 && activeItems.length === 0) {
    await updateLocalMemory(memoryId, {
      syncStatus: "failed",
      publishError:
        failedItems[0]?.lastError ||
        `${failedItems.length} upload${failedItems.length === 1 ? "" : "s"} failed.`,
    });
    return;
  }

  await updateLocalMemory(memoryId, {
    syncStatus: "publishing",
    publishError: undefined,
  });
}

async function patchMemoryAfterUpload(
  item: UploadQueueItem,
  uploadedUrl: string
) {
  const memory = await getLocalMemoryById(item.memoryId);
  if (!memory) return;

  if (item.mediaType === "photo") {
    await updateLocalMemory(item.memoryId, {
      photoUrl: uploadedUrl,
      publishError: undefined,
    });
    return;
  }

  const segments = Array.isArray(memory.segments)
    ? memory.segments.map((segment: LocalMemorySegment) =>
        segment.id === item.segmentId
          ? {
              ...segment,
              syncStatus: "uploaded" as const,
              uploadUrl: uploadedUrl,
              uploadError: undefined,
            }
          : segment
      )
    : memory.segments;

  const isFirstAudioSegment =
    item.mediaType === "audio" &&
    (item.segmentIndex === 0 ||
      !String(memory.voiceUrl || memory.audioUrl || "").trim());

  await updateLocalMemory(item.memoryId, {
    segments,
    voiceUrl: isFirstAudioSegment ? uploadedUrl : memory.voiceUrl,
    audioUrl: isFirstAudioSegment ? uploadedUrl : memory.audioUrl,
    publishError: undefined,
  });
}

async function patchMemoryAfterFailure(item: UploadQueueItem, message: string) {
  const memory = await getLocalMemoryById(item.memoryId);
  if (!memory) return;

  if (item.mediaType === "photo") {
    await updateLocalMemory(item.memoryId, {
      publishError: message,
    });
    return;
  }

  const segments = Array.isArray(memory.segments)
    ? memory.segments.map((segment: LocalMemorySegment) =>
        segment.id === item.segmentId
          ? {
              ...segment,
              syncStatus: "failed" as const,
              uploadError: message,
            }
          : segment
      )
    : memory.segments;

  await updateLocalMemory(item.memoryId, {
    segments,
    publishError: message,
  });
}

async function patchMemoryUploading(item: UploadQueueItem) {
  const memory = await getLocalMemoryById(item.memoryId);

  if (!memory) return;

  if (item.mediaType === "photo") {
    await updateLocalMemory(item.memoryId, {
      syncStatus: "publishing",
      publishError: undefined,
    });
    return;
  }

  const segments = Array.isArray(memory.segments)
    ? memory.segments.map((segment: LocalMemorySegment) =>
        segment.id === item.segmentId
          ? {
              ...segment,
              syncStatus: "uploading" as const,
              uploadError: undefined,
            }
          : segment
      )
    : memory.segments;

  await updateLocalMemory(item.memoryId, {
    syncStatus: "publishing",
    segments,
    publishError: undefined,
  });
}

export async function processUploadQueueOnce(limit = 3, memoryId?: string) {
  if (uploadWorkerRunning) {
    return [];
  }

  uploadWorkerRunning = true;

  try {
    const pending = await getPendingUploadQueueItems(memoryId);
    const items = pending.slice(0, limit);

    const results = [];

    for (const item of items) {
      try {
        await markUploadItemUploading(item.id);
        await patchMemoryUploading(item);
        await updateMemoryUploadState(item.memoryId);

        const blob = await uriToBlob(item.uri);

        const storagePath = getStoragePath({
          authorId: item.authorId,
          memoryId: item.memoryId,
          segmentId: item.segmentId,
          mediaType: item.mediaType,
        });

        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, blob, {
          contentType: getContentType(item.mediaType),
          customMetadata: {
            memoryId: item.memoryId,
            segmentId: item.segmentId,
            segmentIndex: String(item.segmentIndex),
            mediaType: item.mediaType,
            authorId: item.authorId || "",
          },
        });

        const uploadedUrl = await getDownloadURL(storageRef);

        await markUploadItemUploaded(item.id, uploadedUrl);
        await patchMemoryAfterUpload(item, uploadedUrl);
        await updateMemoryUploadState(item.memoryId);

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
        await patchMemoryAfterFailure(item, message);
        await updateMemoryUploadState(item.memoryId);

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