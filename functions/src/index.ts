import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const db = getFirestore();
const bucket = getStorage().bucket();

function clampWords(value: string, maxWords: number) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function cleanSpaces(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function makeTranscriptPreview(value: string, maxLength = 180) {
  const clean = cleanSpaces(value);
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function safeGeneratedTitle(value: string, fallback: string) {
  const cleaned = cleanSpaces(value)
    .replace(/^[-–—:;,]+/, "")
    .replace(/[.!?]+$/g, "");

  const limited = clampWords(cleaned, 6).slice(0, 64).trim();
  return limited || fallback;
}

function safeGeneratedCaption(value: string, fallback: string) {
  const cleaned = cleanSpaces(value).slice(0, 180).trim();
  return cleaned || fallback;
}

async function transcribeAudio(openai: OpenAI, localAudioPath: string) {
  const transcript = await openai.audio.transcriptions.create({
    file: createReadStream(localAudioPath),
    model: "gpt-4o-mini-transcribe",
    response_format: "json",
  });

  return cleanSpaces(transcript.text || "");
}

async function generateTitleAndCaption(
  openai: OpenAI,
  transcript: string,
  fallbackTitle: string,
  fallbackCaption: string
) {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You write short hunting-memory metadata for DeerCamp posts. Return strict JSON with keys title and caption. " +
              "Title rules: 3 to 6 words, plain spoken, no quotes, no hashtags, no emojis, no ending punctuation. " +
              "Caption rules: 1 sentence, 8 to 18 words, grounded only in the transcript, no invented details. " +
              "Ignore filler words, ums, dead air, and microphone noise. If the transcript is too weak, return the supplied fallbacks unchanged.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              transcript,
              fallbackTitle,
              fallbackCaption,
            }),
          },
        ],
      },
    ],
  });

  const raw = cleanSpaces(response.output_text || "");

  if (!raw) {
    return {
      title: fallbackTitle,
      caption: fallbackCaption,
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      caption?: string;
    };

    return {
      title: safeGeneratedTitle(parsed.title || "", fallbackTitle),
      caption: safeGeneratedCaption(parsed.caption || "", fallbackCaption),
    };
  } catch (error) {
    logger.warn("Could not parse generated metadata JSON; using fallbacks.", {
      raw,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      title: fallbackTitle,
      caption: fallbackCaption,
    };
  }
}

export const enrichPublishedMemory = onDocumentCreated(
  {
    document: "feedItems/{feedDocId}",
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const feedDocId = event.params.feedDocId as string;
    const data = snapshot.data() as Record<string, unknown>;

    if (String(data.source || "") !== "app") {
      return;
    }

    if (String(data.transcriptionStatus || "pending") !== "pending") {
      return;
    }

    const audioPath = String(data.audioPath || "").trim();
    const currentTitle = String(data.title || "Field Memory").trim() || "Field Memory";
    const currentCaption =
      String(data.caption || "Captured in DeerCamp Field Mode.").trim() ||
      "Captured in DeerCamp Field Mode.";

    if (!audioPath) {
      await snapshot.ref.update({
        transcriptionStatus: "failed",
        transcriptionError: "Missing audio path for cloud transcription.",
        aiUpdatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deercamp-audio-"));
    const ext = path.extname(audioPath) || ".m4a";
    const localAudioPath = path.join(tmpDir, `memory${ext}`);

    try {
      await bucket.file(audioPath).download({ destination: localAudioPath });

      const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const transcript = await transcribeAudio(openai, localAudioPath);

      if (!transcript) {
        await snapshot.ref.update({
          transcriptionStatus: "failed",
          transcriptionError: "No usable speech detected.",
          transcript: "",
          transcriptPreview: "",
          aiUpdatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const generated = await generateTitleAndCaption(
        openai,
        transcript,
        currentTitle,
        currentCaption
      );

      const titleSource = String(data.titleSource || "fallback") === "manual" ? "manual" : "generated";
      const captionSource = String(data.captionSource || "fallback") === "manual" ? "manual" : "generated";

      await snapshot.ref.update({
        title: titleSource === "manual" ? currentTitle : generated.title,
        caption: captionSource === "manual" ? currentCaption : generated.caption,
        generatedTitle: generated.title,
        generatedCaption: generated.caption,
        titleSource,
        captionSource,
        transcript,
        transcriptPreview: makeTranscriptPreview(transcript),
        transcriptionStatus: "complete",
        transcriptionError: "",
        aiUpdatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection("feedItems").doc(feedDocId).collection("ai").doc("metadata").set(
        {
          transcript,
          generatedTitle: generated.title,
          generatedCaption: generated.caption,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      logger.error("Cloud title generation failed.", {
        feedDocId,
        error: error instanceof Error ? error.message : String(error),
      });

      await snapshot.ref.update({
        transcriptionStatus: "failed",
        transcriptionError:
          error instanceof Error ? error.message : "Cloud title generation failed.",
        aiUpdatedAt: FieldValue.serverTimestamp(),
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
);
