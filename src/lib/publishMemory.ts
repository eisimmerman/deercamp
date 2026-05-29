import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "./firebase";
import { DEFAULT_ACTIVE_CAMP_ID, type LocalMemoryItem, type LocalMemorySegment } from "./localMemories";

export type PublishableMemory = {
  id: string;
  imageUri?: string | null;
  photoUri?: string | null;
  photoUrl?: string | null;
  audioUri?: string | null;
  voiceUri?: string | null;
  voiceUrl?: string | null;
  audioUrl?: string | null;
  title?: string | null;
  caption?: string | null;
  details?: string | null;
  createdAt?: string | number | Date | null;
  clientCreatedAt?: number | null;
  campId?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  type?: string | null;
  segments?: LocalMemorySegment[] | null;
  totalDurationMs?: number | null;
};

export type PublishedFeedResult = {
  feedDocId: string;
  campId: string;
  imageUrl: string;
  audioUrl?: string;
  title: string;
  caption: string;
};

function requireSignedInUser() {
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error("You must be signed in to publish to Feed.");
  }

  return user;
}

function pickImageUri(memory: PublishableMemory) {
  return memory.imageUri || memory.photoUri || null;
}

function pickAudioUri(memory: PublishableMemory) {
  const direct = memory.audioUri || memory.voiceUri;
  if (direct) return direct;

  const segments = Array.isArray(memory.segments) ? memory.segments : [];
  const firstAudioSegment = segments
    .filter((segment) => segment?.mediaType === "audio" && String(segment?.uri || "").trim())
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))[0];

  return firstAudioSegment?.uri || null;
}

function pickUploadedImageUrl(memory: PublishableMemory) {
  return String(memory.photoUrl || "").trim();
}

function pickUploadedAudioUrl(memory: PublishableMemory) {
  const direct = String(memory.voiceUrl || memory.audioUrl || "").trim();
  if (direct) return direct;

  const segments = Array.isArray(memory.segments) ? memory.segments : [];
  const uploadedAudio = segments
    .filter((segment) => String(segment?.uploadUrl || "").trim())
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))[0];

  return String(uploadedAudio?.uploadUrl || "").trim();
}

function getFileExtension(uri: string, fallback: string) {
  const clean = uri.split("?")[0]?.split("#")[0] || "";
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || fallback;
}

function getImageContentType(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}

function getAudioContentType(ext: string) {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "m4a":
      return "audio/mp4";
    case "caf":
      return "audio/x-caf";
    default:
      return "application/octet-stream";
  }
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getCleanAuthorName(user: NonNullable<typeof auth.currentUser>) {
  const displayName = user.displayName?.trim() || "";

  if (displayName && displayName.toLowerCase() !== "5pt") {
    return displayName;
  }

  const email = user.email?.trim() || "";
  if (email) {
    const localPart = email.split("@")[0]?.trim() || "";
    const cleaned = localPart
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned) {
      return toTitleCase(cleaned);
    }

    return email;
  }

  return "DeerCamp Member";
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(`Failed to read local file: ${uri}`);
  }

  return await response.blob();
}

function trimOrFallback(value: string | null | undefined, fallback: string) {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function stripLocalUploadStatus(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s*Ready to upload\.?\s*/gi, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanCaptionOrFallback(value: string | null | undefined, fallback: string) {
  const clean = stripLocalUploadStatus(value);
  return clean || fallback;
}

function resolvePublishCampId(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean || clean === "ourdeercamp") return DEFAULT_ACTIVE_CAMP_ID;
  return clean;
}

function getMemoryTitle(memory: PublishableMemory) {
  const explicit = String(memory.title || "").trim();
  if (explicit) return explicit;
  return memory.type === "photo" ? "Field Photo" : "Field Memory";
}

function getMemoryCaption(memory: PublishableMemory) {
  const fallback = memory.type === "photo"
    ? "Photo captured in DeerCamp Field Mode."
    : "Photo + voice captured in DeerCamp Field Mode.";

  return cleanCaptionOrFallback(memory.caption || memory.details, fallback);
}

function getClientCreatedAt(memory: PublishableMemory) {
  if (typeof memory.clientCreatedAt === "number") return memory.clientCreatedAt;
  if (typeof memory.createdAt === "number") return memory.createdAt;

  if (memory.createdAt instanceof Date) return memory.createdAt.getTime();

  const parsed = memory.createdAt ? Date.parse(String(memory.createdAt)) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildFeedDoc(params: {
  user: NonNullable<typeof auth.currentUser>;
  memory: PublishableMemory;
  campId: string;
  title: string;
  caption: string;
  imageUrl: string;
  audioUrl?: string;
  imagePath?: string;
  audioPath?: string;
}) {
  const mediaType = params.audioUrl ? "photo-voice" : "photo";
  const authorName =
    String(params.memory.authorName || "").trim() || getCleanAuthorName(params.user);
  const clientCreatedAt = getClientCreatedAt(params.memory);

  const doc: Record<string, any> = {
    campId: params.campId,
    authorId: params.user.uid,
    authorName,
    author: authorName,
    title: params.title,
    caption: params.caption,
    body: params.caption,
    titleSource: String(params.memory.title || "").trim() ? "manual" : "fallback",
    captionSource:
      String(params.memory.caption || params.memory.details || "").trim()
        ? "manual"
        : "fallback",
    transcript: "",
    transcriptPreview: "",
    transcriptionStatus: params.audioUrl ? "pending" : "not_applicable",
    transcriptionError: "",
    generatedTitle: "",
    generatedCaption: "",
    imageUrl: params.imageUrl,
    displayUrl: params.imageUrl,
    thumbUrl: params.imageUrl,
    thumbnailUrl: params.imageUrl,
    mediaType,
    type: mediaType,
    category: "field-note",
    tags: params.audioUrl ? ["Field Memory", "Photo", "Voice"] : ["Field Memory", "Photo"],
    published: true,
    source: "app",
    localMemoryId: params.memory.id,
    createdAt: serverTimestamp(),
    createdAtMs: clientCreatedAt,
    clientCreatedAt,
    aiRequestedAt: params.audioUrl ? serverTimestamp() : null,
  };

  if (params.audioUrl) {
    doc.audioUrl = params.audioUrl;
    doc.voiceUrl = params.audioUrl;
  }

  if (params.imagePath) doc.imagePath = params.imagePath;
  if (params.audioPath) doc.audioPath = params.audioPath;

  return doc;
}


async function findExistingFeedPost(params: {
  memoryId: string;
  campId: string;
}): Promise<PublishedFeedResult | null> {
  const memoryId = String(params.memoryId || "").trim();
  const campId = resolvePublishCampId(params.campId);

  if (!memoryId) return null;

  const snapshot = await getDocs(
    query(
      collection(db, "feedItems"),
      where("localMemoryId", "==", memoryId),
      where("campId", "==", campId),
      limit(1)
    )
  );

  const existing = snapshot.docs[0];
  if (!existing) return null;

  const data = existing.data() as Record<string, any>;
  const imageUrl = String(
    data.imageUrl || data.displayUrl || data.photoUrl || data.thumbUrl || ""
  ).trim();

  if (!imageUrl) return null;

  const audioUrl = String(data.audioUrl || data.voiceUrl || "").trim();
  const title = trimOrFallback(data.title, "Field Memory");
  const caption = cleanCaptionOrFallback(
    data.caption || data.body,
    "Captured in DeerCamp Field Mode."
  );

  return {
    feedDocId: existing.id,
    campId,
    imageUrl,
    audioUrl: audioUrl || undefined,
    title,
    caption,
  };
}

export async function publishUploadedMemoryToFeed(
  memory: PublishableMemory | LocalMemoryItem,
  options?: {
    campId?: string;
    defaultTitle?: string;
    defaultCaption?: string;
  }
): Promise<PublishedFeedResult> {
  const user = requireSignedInUser();

  const campId = resolvePublishCampId(options?.campId || memory.campId);
  const title = trimOrFallback(options?.defaultTitle || getMemoryTitle(memory), "Field Memory");
  const caption = cleanCaptionOrFallback(
    options?.defaultCaption || getMemoryCaption(memory),
    "Captured in DeerCamp Field Mode."
  );

  const imageUrl = pickUploadedImageUrl(memory);
  const audioUrl = pickUploadedAudioUrl(memory);

  if (!memory?.id) {
    throw new Error("Memory is missing an id.");
  }

  if (!imageUrl) {
    throw new Error("Memory is missing an uploaded photo URL.");
  }

  const existingPost = await findExistingFeedPost({
    memoryId: memory.id,
    campId,
  });

  if (existingPost) {
    return existingPost;
  }

  const docRef = await addDoc(
    collection(db, "feedItems"),
    buildFeedDoc({
      user,
      memory,
      campId,
      title,
      caption,
      imageUrl,
      audioUrl: audioUrl || undefined,
    })
  );

  return {
    feedDocId: docRef.id,
    campId,
    imageUrl,
    audioUrl: audioUrl || undefined,
    title,
    caption,
  };
}

export async function publishMemoryToFeed(
  memory: PublishableMemory,
  options?: {
    campId?: string;
    defaultTitle?: string;
    defaultCaption?: string;
  }
) {
  const user = requireSignedInUser();

  const campId = resolvePublishCampId(options?.campId || memory.campId);
  const defaultTitle = trimOrFallback(options?.defaultTitle, "Field Memory");
  const defaultCaption = cleanCaptionOrFallback(
    options?.defaultCaption || memory.details,
    "Captured in DeerCamp Field Mode."
  );

  const manualTitle = String(memory.title || "").trim();
  const manualCaption = stripLocalUploadStatus(memory.caption);

  const baseTitle = manualTitle || defaultTitle;
  const baseCaption = manualCaption || defaultCaption;

  const imageUri = pickImageUri(memory);
  const audioUri = pickAudioUri(memory);

  if (!memory?.id) {
    throw new Error("Memory is missing an id.");
  }

  const existingPost = await findExistingFeedPost({
    memoryId: memory.id,
    campId,
  });

  if (existingPost) {
    return existingPost;
  }

  if (!imageUri) {
    throw new Error("Memory is missing an image/photo file.");
  }

  const imageExt = getFileExtension(imageUri, "jpg");
  const imageContentType = getImageContentType(imageExt);
  const imagePath = `feed/${campId}/${user.uid}/${memory.id}/photo.${imageExt}`;
  const imageBlob = await uriToBlob(imageUri);
  const imageRef = ref(storage, imagePath);

  await uploadBytes(imageRef, imageBlob, {
    contentType: imageContentType,
  });

  const imageUrl = await getDownloadURL(imageRef);

  let audioUrl = "";
  let audioPath = "";

  if (audioUri) {
    const audioExt = getFileExtension(audioUri, "m4a");
    const audioContentType = getAudioContentType(audioExt);
    audioPath = `feed/${campId}/${user.uid}/${memory.id}/audio.${audioExt}`;
    const audioBlob = await uriToBlob(audioUri);
    const audioRef = ref(storage, audioPath);

    await uploadBytes(audioRef, audioBlob, {
      contentType: audioContentType,
    });

    audioUrl = await getDownloadURL(audioRef);
  }

  const docRef = await addDoc(
    collection(db, "feedItems"),
    buildFeedDoc({
      user,
      memory,
      campId,
      title: baseTitle,
      caption: baseCaption,
      imageUrl,
      audioUrl: audioUrl || undefined,
      imagePath,
      audioPath: audioPath || undefined,
    })
  );

  return {
    feedDocId: docRef.id,
    campId,
    imageUrl,
    audioUrl: audioUrl || undefined,
    title: baseTitle,
    caption: baseCaption,
  };
}
