import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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
  audioDurationMs?: number | null;
  audioDurationSeconds?: number | null;
  voiceDurationMs?: number | null;
  voiceDurationSeconds?: number | null;
  audioContentType?: string | null;
  voiceContentType?: string | null;
  platform?: string | null;
  devicePlatform?: string | null;
  sourcePlatform?: string | null;
  appPlatform?: string | null;
  operatingSystem?: string | null;
  deviceInfo?: {
    platform?: string | null;
    os?: string | null;
    operatingSystem?: string | null;
    appSource?: string | null;
    appVersion?: string | null;
  } | null;
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

function normalizeFieldMemoryPlatform(value?: string | null) {
  const raw = String(value || "").trim();
  const clean = raw.toLowerCase();

  if (!clean) return "";
  if (clean.includes("android")) return "Android";
  if (
    clean === "ios" ||
    clean.includes("iphone") ||
    clean.includes("ipad") ||
    clean.includes("ipod") ||
    clean.includes("ios")
  ) {
    return "iOS";
  }

  return raw;
}

function getMemoryPlatform(memory: PublishableMemory) {
  const deviceInfo = memory.deviceInfo && typeof memory.deviceInfo === "object" ? memory.deviceInfo : {};
  const candidates = [
    memory.platform,
    memory.devicePlatform,
    memory.sourcePlatform,
    memory.appPlatform,
    memory.operatingSystem,
    deviceInfo.platform,
    deviceInfo.os,
    deviceInfo.operatingSystem,
  ];

  for (const candidate of candidates) {
    const label = normalizeFieldMemoryPlatform(candidate || "");
    if (label) return label;
  }

  return "";
}

function getMemoryAudioDurationMs(memory: PublishableMemory) {
  const directMs = Number(
    memory.audioDurationMs ||
      memory.voiceDurationMs ||
      memory.totalDurationMs ||
      0
  );

  if (Number.isFinite(directMs) && directMs > 0) return Math.round(directMs);

  const seconds = Number(memory.audioDurationSeconds || memory.voiceDurationSeconds || 0);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);

  const segments = Array.isArray(memory.segments) ? memory.segments : [];
  const segmentTotal = segments.reduce(
    (sum, segment) => sum + Math.max(0, Number(segment.durationMs || 0)),
    0
  );

  return segmentTotal > 0 ? Math.round(segmentTotal) : 0;
}

function getMemoryAudioContentType(memory: PublishableMemory, audioPath?: string, audioUrl?: string) {
  const explicit = String(memory.audioContentType || memory.voiceContentType || "").trim();
  if (explicit && explicit !== "application/octet-stream") return explicit;

  const candidate = String(audioPath || audioUrl || pickAudioUri(memory) || "").trim();
  if (!candidate) return "";
  return getAudioContentType(getFileExtension(candidate, "m4a"));
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
  const explicit = String(memory.caption || memory.details || "").trim();
  if (explicit) return explicit;

  return memory.type === "photo"
    ? "Photo captured in DeerCamp Field Mode."
    : "Photo + voice captured in DeerCamp Field Mode.";
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
  const platform = getMemoryPlatform(params.memory);
  const audioDurationMs = params.audioUrl ? getMemoryAudioDurationMs(params.memory) : 0;
  const audioDurationSeconds = audioDurationMs > 0 ? Math.round(audioDurationMs / 1000) : 0;
  const audioContentType = params.audioUrl
    ? getMemoryAudioContentType(params.memory, params.audioPath, params.audioUrl)
    : "";
  const tags = params.audioUrl
    ? ["Picture", "Voice", "Field Memory"]
    : ["Picture", "Field Memory"];

  if (platform) tags.push(platform);

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
    tags,
    published: true,
    source: "app",
    localMemoryId: params.memory.id,
    createdAt: serverTimestamp(),
    createdAtMs: clientCreatedAt,
    clientCreatedAt,
    aiRequestedAt: params.audioUrl ? serverTimestamp() : null,
  };

  if (platform) {
    doc.platform = platform;
    doc.devicePlatform = platform;
    doc.sourcePlatform = platform;
    doc.appPlatform = platform;
    doc.operatingSystem = String(params.memory.operatingSystem || platform).trim();
    doc.deviceInfo = {
      ...(params.memory.deviceInfo || {}),
      platform,
      os: platform,
      operatingSystem: String(params.memory.operatingSystem || platform).trim(),
      appSource: String(params.memory.deviceInfo?.appSource || "CampFieldApp").trim(),
    };
  }

  if (params.audioUrl) {
    doc.audioUrl = params.audioUrl;
    doc.voiceUrl = params.audioUrl;
    if (audioContentType) {
      doc.audioContentType = audioContentType;
      doc.voiceContentType = audioContentType;
    }
    if (audioDurationMs > 0) {
      doc.audioDurationMs = audioDurationMs;
      doc.voiceDurationMs = audioDurationMs;
      doc.audioDurationSeconds = audioDurationSeconds;
      doc.voiceDurationSeconds = audioDurationSeconds;
    }
  }

  if (params.imagePath) doc.imagePath = params.imagePath;
  if (params.audioPath) doc.audioPath = params.audioPath;

  return doc;
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
  const caption = trimOrFallback(
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
  const defaultCaption = trimOrFallback(
    options?.defaultCaption || memory.details,
    "Captured in DeerCamp Field Mode."
  );

  const manualTitle = String(memory.title || "").trim();
  const manualCaption = String(memory.caption || "").trim();

  const baseTitle = manualTitle || defaultTitle;
  const baseCaption = manualCaption || defaultCaption;

  const imageUri = pickImageUri(memory);
  const audioUri = pickAudioUri(memory);

  if (!memory?.id) {
    throw new Error("Memory is missing an id.");
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
