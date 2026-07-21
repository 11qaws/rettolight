export const BROADCAST_CONTEXT_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_BROADCAST_CONTEXT_SOURCE_DURATION_MS = 12 * 60 * 60_000;
export const MAX_BROADCAST_CONTEXT_CHAPTERS = 144;
export const MAX_BROADCAST_CONTEXT_CANDIDATES = 12;
export const MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH = 1_200;
export const MAX_BROADCAST_CONTEXT_TRANSCRIPT_LENGTH = 12_000;

const MAX_IDENTIFIER_LENGTH = 256;

export interface BroadcastContextChapterInput {
  readonly chapterId: string;
  readonly startMs: number;
  readonly endMs: number;
  /** Bounded phase/chapter summary produced before whole-context reduction. */
  readonly summaryKo: string;
}

export interface BroadcastContextCandidateInput {
  readonly candidateId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly transcriptKo: string;
  readonly eventSummaryKo: string;
  readonly reactionSummaryKo: string;
  readonly chatReactionSummaryKo: string | null;
}

export interface BroadcastContextRequestInput {
  readonly sourceDurationMs: number;
  readonly chapters: readonly BroadcastContextChapterInput[];
  readonly candidates: readonly BroadcastContextCandidateInput[];
}

export interface BroadcastContextRequest {
  readonly schemaVersion: typeof BROADCAST_CONTEXT_SCHEMA_VERSION;
  readonly sourceDurationMs: number;
  readonly chapters: readonly BroadcastContextChapterInput[];
  readonly candidates: readonly BroadcastContextCandidateInput[];
}

export type BroadcastContextCandidateCategory =
  | "reaction"
  | "quiet-achievement"
  | "setup-and-payoff"
  | "running-gag"
  | "context-dependent"
  | "uncertain";

/**
 * Provider output may explain and classify an existing candidate only. It has
 * no score, rank, range, or approval fields, so it cannot mutate canonical
 * fast-pass decisions when a reducer is added later.
 */
export interface BroadcastContextCandidateAnnotation {
  readonly candidateId: string;
  readonly category: BroadcastContextCandidateCategory;
  readonly contextSummaryKo: string;
  readonly whyThisMomentKo: string;
  readonly relatedCandidateIds: readonly string[];
  readonly uncertaintiesKo: readonly string[];
}

export interface BroadcastContextResult {
  readonly schemaVersion: typeof BROADCAST_CONTEXT_SCHEMA_VERSION;
  readonly broadcastSummaryKo: string;
  readonly recurringThemesKo: readonly string[];
  readonly annotations: readonly BroadcastContextCandidateAnnotation[];
}

export type BroadcastContextInputErrorCode =
  | "INVALID_SOURCE_DURATION"
  | "INVALID_CHAPTER_COUNT"
  | "INVALID_CANDIDATE_COUNT"
  | "INVALID_IDENTIFIER"
  | "DUPLICATE_IDENTIFIER"
  | "INVALID_RANGE"
  | "OVERLAPPING_CHAPTERS"
  | "INVALID_TEXT";

export class BroadcastContextInputError extends Error {
  public readonly code: BroadcastContextInputErrorCode;
  public readonly itemId: string | null;

  public constructor(
    code: BroadcastContextInputErrorCode,
    message: string,
    itemId: string | null = null,
  ) {
    super(message);
    this.name = "BroadcastContextInputError";
    this.code = code;
    this.itemId = itemId;
  }
}

function isValidIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}

function assertIdentifier(value: string): void {
  if (!isValidIdentifier(value)) {
    throw new BroadcastContextInputError(
      "INVALID_IDENTIFIER",
      "Broadcast context item IDs must be non-empty, trimmed, and bounded.",
      value,
    );
  }
}

function assertRange(
  startMs: number,
  endMs: number,
  sourceDurationMs: number,
  itemId: string,
): void {
  if (
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    startMs < 0 ||
    endMs > sourceDurationMs ||
    startMs >= endMs
  ) {
    throw new BroadcastContextInputError(
      "INVALID_RANGE",
      "Broadcast context ranges must be integer ranges inside the source.",
      itemId,
    );
  }
}

function assertText(
  value: string,
  maxLength: number,
  itemId: string,
  allowEmpty = false,
): void {
  const length = Array.from(value).length;
  const controlCheckValue = value.replace(/[\n\r\t]/gu, "");
  if (
    value.trim() !== value ||
    (!allowEmpty && length === 0) ||
    length > maxLength ||
    /[\p{Cc}\p{Cf}]/u.test(controlCheckValue)
  ) {
    throw new BroadcastContextInputError(
      "INVALID_TEXT",
      "Broadcast context text must be trimmed and stay inside its size limit.",
      itemId,
    );
  }
}

function assertUniqueIdentifiers(
  identifiers: readonly string[],
): void {
  const seen = new Set<string>();
  for (const identifier of identifiers) {
    assertIdentifier(identifier);
    if (seen.has(identifier)) {
      throw new BroadcastContextInputError(
        "DUPLICATE_IDENTIFIER",
        "Broadcast context item IDs must be unique inside their collection.",
        identifier,
      );
    }
    seen.add(identifier);
  }
}

/**
 * Validates and snapshots the bounded, text-only payload that a future context
 * reducer may send. Files, raw audio/video, chat authors, scores, and review
 * state are deliberately absent.
 */
export function createBroadcastContextRequest(
  input: BroadcastContextRequestInput,
): BroadcastContextRequest {
  if (
    !Number.isSafeInteger(input.sourceDurationMs) ||
    input.sourceDurationMs <= 0 ||
    input.sourceDurationMs > MAX_BROADCAST_CONTEXT_SOURCE_DURATION_MS
  ) {
    throw new BroadcastContextInputError(
      "INVALID_SOURCE_DURATION",
      "Broadcast context source duration must be an integer from 1 ms to 12 hours.",
    );
  }
  if (
    input.chapters.length < 1 ||
    input.chapters.length > MAX_BROADCAST_CONTEXT_CHAPTERS
  ) {
    throw new BroadcastContextInputError(
      "INVALID_CHAPTER_COUNT",
      "Broadcast context requires between 1 and 144 bounded chapter summaries.",
    );
  }
  if (
    input.candidates.length < 1 ||
    input.candidates.length > MAX_BROADCAST_CONTEXT_CANDIDATES
  ) {
    throw new BroadcastContextInputError(
      "INVALID_CANDIDATE_COUNT",
      "Broadcast context requires between 1 and 12 existing candidates.",
    );
  }

  assertUniqueIdentifiers(input.chapters.map((chapter) => chapter.chapterId));
  assertUniqueIdentifiers(input.candidates.map((candidate) => candidate.candidateId));

  let previousChapterEndMs = 0;
  const chapters = input.chapters.map((chapter, index) => {
    assertRange(
      chapter.startMs,
      chapter.endMs,
      input.sourceDurationMs,
      chapter.chapterId,
    );
    if (index > 0 && chapter.startMs < previousChapterEndMs) {
      throw new BroadcastContextInputError(
        "OVERLAPPING_CHAPTERS",
        "Broadcast context chapters must be ordered and non-overlapping.",
        chapter.chapterId,
      );
    }
    previousChapterEndMs = chapter.endMs;
    assertText(
      chapter.summaryKo,
      MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
      chapter.chapterId,
    );
    return {
      chapterId: chapter.chapterId,
      startMs: chapter.startMs,
      endMs: chapter.endMs,
      summaryKo: chapter.summaryKo,
    };
  });

  const candidates = input.candidates.map((candidate) => {
    assertRange(
      candidate.startMs,
      candidate.endMs,
      input.sourceDurationMs,
      candidate.candidateId,
    );
    assertText(
      candidate.transcriptKo,
      MAX_BROADCAST_CONTEXT_TRANSCRIPT_LENGTH,
      candidate.candidateId,
      true,
    );
    assertText(
      candidate.eventSummaryKo,
      MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
      candidate.candidateId,
    );
    assertText(
      candidate.reactionSummaryKo,
      MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
      candidate.candidateId,
    );
    if (candidate.chatReactionSummaryKo !== null) {
      assertText(
        candidate.chatReactionSummaryKo,
        MAX_BROADCAST_CONTEXT_SUMMARY_LENGTH,
        candidate.candidateId,
        true,
      );
    }
    return {
      candidateId: candidate.candidateId,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      transcriptKo: candidate.transcriptKo,
      eventSummaryKo: candidate.eventSummaryKo,
      reactionSummaryKo: candidate.reactionSummaryKo,
      chatReactionSummaryKo: candidate.chatReactionSummaryKo,
    };
  });

  return {
    schemaVersion: BROADCAST_CONTEXT_SCHEMA_VERSION,
    sourceDurationMs: input.sourceDurationMs,
    chapters,
    candidates,
  };
}
