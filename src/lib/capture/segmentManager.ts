// src/lib/capture/segmentManager.ts
import { RecordingPresets } from "expo-audio";

export const DEFAULT_AUDIO_SEGMENT_MS = 60_000;

export type CaptureSegment = {
  id: string;
  memoryId: string;
  index: number;
  uri: string;
  mediaType: "audio";
  durationMs?: number;
  createdAt: number;
  syncStatus: "pending";
  transcriptionStatus: "pending";
};

export type SegmentManagerState = {
  memoryId: string;
  startedAt: number;
  nextIndex: number;
  segments: CaptureSegment[];
};

export function createSegmentMemoryId(authorId: string) {
  return `local-${authorId}-${Date.now()}`;
}

export function createInitialSegmentState(memoryId: string): SegmentManagerState {
  return {
    memoryId,
    startedAt: Date.now(),
    nextIndex: 1,
    segments: [],
  };
}

export function createAudioSegment(params: {
  state: SegmentManagerState;
  uri: string;
  durationMs?: number;
}): {
  segment: CaptureSegment;
  nextState: SegmentManagerState;
} {
  const createdAt = Date.now();
  const index = params.state.nextIndex;

  const segment: CaptureSegment = {
    id: `${params.state.memoryId}-segment-${String(index).padStart(3, "0")}`,
    memoryId: params.state.memoryId,
    index,
    uri: params.uri,
    mediaType: "audio",
    durationMs: params.durationMs,
    createdAt,
    syncStatus: "pending",
    transcriptionStatus: "pending",
  };

  return {
    segment,
    nextState: {
      ...params.state,
      nextIndex: index + 1,
      segments: [...params.state.segments, segment],
    },
  };
}

export function getSegmentSummary(state: SegmentManagerState) {
  const totalDurationMs = state.segments.reduce(
    (sum, segment) => sum + (segment.durationMs || 0),
    0
  );

  return {
    segmentCount: state.segments.length,
    totalDurationMs,
    segments: state.segments,
  };
}

export { RecordingPresets };