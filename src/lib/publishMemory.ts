import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "./firebase";

export type PublishableMemory = {
  id: string;
  imageUri?: string | null;
  photoUri?: string | null;
  audioUri?: string | null;
  voiceUri?: string | null;
  title?: string | null;
  caption?: string | null;
  createdAt?: string | number | Date | null;
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
  return memory.audioUri || memory.voiceUri || null;
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

export async function publishMemoryToFeed(
  memory: PublishableMemory,
  options?: {
    campId?: string;
    defaultTitle?: string;
    defaultCaption?: string;
  }
) {
  const user = requireSignedInUser();

  const campId = options?.campId || "ourdeercamp";
  const defaultTitle = options?.defaultTitle || "Field Memory";
  const defaultCaption =
    options?.defaultCaption || "Captured in DeerCamp Field Mode.";

  const imageUri = pickImageUri(memory);
  const audioUri = pickAudioUri(memory);

  if (!memory?.id) {
    throw new Error("Memory is missing an id.");
  }

  if (!imageUri) {
    throw new Error("Memory is missing an image/photo file.");
  }

  if (!audioUri) {
    throw new Error("Memory is missing an audio/voice file.");
  }

  const imageExt = getFileExtension(imageUri, "jpg");
  const audioExt = getFileExtension(audioUri, "m4a");

  const imageContentType = getImageContentType(imageExt);
  const audioContentType = getAudioContentType(audioExt);

  const imagePath = `feed/${campId}/${user.uid}/${memory.id}/photo.${imageExt}`;
  const audioPath = `feed/${campId}/${user.uid}/${memory.id}/audio.${audioExt}`;

  const imageBlob = await uriToBlob(imageUri);
  const audioBlob = await uriToBlob(audioUri);

  const imageRef = ref(storage, imagePath);
  const audioRef = ref(storage, audioPath);

  await uploadBytes(imageRef, imageBlob, {
    contentType: imageContentType,
  });

  await uploadBytes(audioRef, audioBlob, {
    contentType: audioContentType,
  });

  const imageUrl = await getDownloadURL(imageRef);
  const audioUrl = await getDownloadURL(audioRef);

  const docRef = await addDoc(collection(db, "feedItems"), {
    campId,
    authorId: user.uid,
    authorName: getCleanAuthorName(user),
    title: memory.title?.trim() || defaultTitle,
    caption: memory.caption?.trim() || defaultCaption,
    imageUrl,
    audioUrl,
    imagePath,
    audioPath,
    published: true,
    source: "app",
    localMemoryId: memory.id,
    createdAt: serverTimestamp(),
  });

  return {
    ok: true,
    feedDocId: docRef.id,
    imageUrl,
    audioUrl,
    imagePath,
    audioPath,
  };
}
