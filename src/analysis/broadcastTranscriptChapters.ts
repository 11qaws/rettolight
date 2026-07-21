import {
  MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
  type BroadcastContextChapterInput,
} from "./broadcastContextProtocol";
import type { BroadcastTranscriptQwenResult } from "./broadcastTranscriptQwen";

function truncateCodePoints(value: string, maximumLength: number): string {
  const points = Array.from(value);
  return points.length <= maximumLength
    ? value
    : `${points.slice(0, Math.max(0, maximumLength - 1)).join("")}…`;
}

/**
 * Turns source-fenced ASR cells into the exact chapter evidence accepted by the
 * whole-context model. No sentence timestamp is invented inside an ASR cell.
 */
export function createBroadcastTranscriptChapters(
  transcripts: readonly BroadcastTranscriptQwenResult[],
  sourceDurationMs: number,
  completeAudioCoverage: boolean,
): readonly BroadcastContextChapterInput[] {
  if (!Number.isSafeInteger(sourceDurationMs) || sourceDurationMs <= 0) {
    throw new RangeError("Broadcast transcript source duration is invalid.");
  }
  const ordered = [...transcripts].sort(
    (left, right) =>
      left.sourceStartMs - right.sourceStartMs ||
      left.sourceEndMs - right.sourceEndMs,
  );
  let previousEndMs = -1;
  return ordered.map((transcript, index) => {
    if (
      !Number.isSafeInteger(transcript.sourceStartMs) ||
      !Number.isSafeInteger(transcript.sourceEndMs) ||
      transcript.sourceStartMs < 0 ||
      transcript.sourceEndMs <= transcript.sourceStartMs ||
      transcript.sourceEndMs > sourceDurationMs ||
      transcript.sourceStartMs < previousEndMs ||
      transcript.textKo.trim().length === 0
    ) {
      throw new RangeError("Broadcast transcript cells must be ordered source ranges.");
    }
    previousEndMs = transcript.sourceEndMs;
    const emotionPrefix = transcript.emotion === null
      ? ""
      : `[감정 단서: ${transcript.emotion}] `;
    return {
      chapterId: `transcript-${String(index + 1).padStart(3, "0")}`,
      startMs: transcript.sourceStartMs,
      endMs: transcript.sourceEndMs,
      evidenceMode: completeAudioCoverage
        ? "complete-transcript"
        : "sampled-audio-video",
      evidenceCoverageRatio: 1,
      summaryKo: truncateCodePoints(
        `${emotionPrefix}${transcript.textKo}`,
        MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
      ),
    };
  });
}
