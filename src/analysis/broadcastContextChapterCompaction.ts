import {
  MAX_BROADCAST_CONTEXT_CHAPTERS,
  MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
  type BroadcastContextChapterInput,
} from "./broadcastContextProtocol";

const COMPACTED_SUMMARY_LENGTH = Math.min(
  1_600,
  MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
);

function boundedRepresentativeText(value: string, maximumLength: number): string {
  const points = Array.from(value.replace(/\s+/gu, " ").trim());
  if (points.length <= maximumLength) return points.join("");
  const separator = " … ";
  const separatorLength = Array.from(separator).length;
  const sampleCount = 4;
  const sampleLength = Math.floor(
    (maximumLength - separatorLength * (sampleCount - 1)) / sampleCount,
  );
  const maximumStart = points.length - sampleLength;
  return Array.from({ length: sampleCount }, (_, index) => {
    const start = Math.round((maximumStart * index) / (sampleCount - 1));
    return points.slice(start, start + sampleLength).join("");
  }).join(separator);
}

function compactGroup(
  group: readonly BroadcastContextChapterInput[],
  ordinal: number,
): BroadcastContextChapterInput {
  const first = group[0];
  const last = group.at(-1);
  if (first === undefined || last === undefined) {
    throw new RangeError("A compacted broadcast chapter group cannot be empty.");
  }
  let coveredMs = 0;
  let weightedCoverageMs = 0;
  let previousEndMs = first.startMs;
  let hasGap = false;
  for (const chapter of group) {
    if (chapter.startMs < previousEndMs || chapter.endMs <= chapter.startMs) {
      throw new RangeError("Broadcast context chapters must be ordered and non-overlapping.");
    }
    if (chapter.startMs > previousEndMs) hasGap = true;
    const durationMs = chapter.endMs - chapter.startMs;
    coveredMs += durationMs;
    weightedCoverageMs += durationMs * chapter.evidenceCoverageRatio;
    previousEndMs = chapter.endMs;
  }
  const spanMs = last.endMs - first.startMs;
  const evidenceCoverageRatio = Math.max(
    Number.EPSILON,
    Math.min(1, weightedCoverageMs / Math.max(1, spanMs)),
  );
  const completeTranscript =
    !hasGap &&
    coveredMs === spanMs &&
    group.every(
      (chapter) =>
        chapter.evidenceMode === "complete-transcript" &&
        chapter.evidenceCoverageRatio === 1,
    );
  const summaryKo = boundedRepresentativeText(
    group
      .map(
        (chapter) =>
          `[${Math.floor(chapter.startMs / 1_000)}초] ${chapter.summaryKo}`,
      )
      .join(" "),
    COMPACTED_SUMMARY_LENGTH,
  );
  return {
    chapterId: `context-${String(ordinal).padStart(3, "0")}`,
    startMs: first.startMs,
    endMs: last.endMs,
    evidenceMode: completeTranscript
      ? "complete-transcript"
      : "sampled-audio-video",
    evidenceCoverageRatio,
    summaryKo,
  };
}

/**
 * Projects a durable transcript map into the bounded whole-context transport.
 * The source evidence is not mutated; adjacent ranges are merged only when the
 * saved map exceeds the current 144-chapter API contract.
 */
export function compactBroadcastContextChapters(
  chapters: readonly BroadcastContextChapterInput[],
  maximumChapterCount = MAX_BROADCAST_CONTEXT_CHAPTERS,
): readonly BroadcastContextChapterInput[] {
  if (!Number.isSafeInteger(maximumChapterCount) || maximumChapterCount < 1) {
    throw new RangeError("The broadcast context chapter limit must be positive.");
  }
  if (chapters.length <= maximumChapterCount) return chapters;

  const compacted: BroadcastContextChapterInput[] = [];
  for (let index = 0; index < maximumChapterCount; index += 1) {
    const startIndex = Math.floor((index * chapters.length) / maximumChapterCount);
    const endIndex = Math.floor(
      ((index + 1) * chapters.length) / maximumChapterCount,
    );
    compacted.push(
      compactGroup(chapters.slice(startIndex, endIndex), index + 1),
    );
  }
  return compacted;
}
