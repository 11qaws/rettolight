import {
  createBroadcastContextRequest,
  type BroadcastContextChapterInput,
} from "../analysis/broadcastContextProtocol";

export const BROADCAST_CONTEXT_SESSION_SCHEMA_VERSION = "1.2.0" as const;

export interface BroadcastContextSessionRecord {
  readonly kind: "broadcastContextSession";
  readonly runId: string;
  readonly schemaVersion: typeof BROADCAST_CONTEXT_SESSION_SCHEMA_VERSION;
  readonly inputSignature: string;
  readonly sourceDurationMs: number;
  readonly completeAudioCoverage: boolean;
  readonly chapters: readonly BroadcastContextChapterInput[];
  readonly gapChunkIds: readonly string[];
  readonly modelRevision: string;
  readonly contextInputSignature: string | null;
  readonly contextResultJson: string | null;
  readonly refinementInputSignature: string | null;
  readonly refinementCandidatesJson: string | null;
  readonly recordedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedString(value: unknown, maximumLength = 512): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}

export function assertBroadcastContextSessionRecord(
  value: unknown,
): asserts value is BroadcastContextSessionRecord {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "runId",
      "schemaVersion",
      "inputSignature",
      "sourceDurationMs",
      "completeAudioCoverage",
      "chapters",
      "gapChunkIds",
      "modelRevision",
      "contextInputSignature",
      "contextResultJson",
      "refinementInputSignature",
      "refinementCandidatesJson",
      "recordedAt",
    ]) ||
    value.kind !== "broadcastContextSession" ||
    value.schemaVersion !== BROADCAST_CONTEXT_SESSION_SCHEMA_VERSION ||
    !boundedString(value.runId) ||
    !boundedString(value.inputSignature) ||
    !Number.isSafeInteger(value.sourceDurationMs) ||
    (value.sourceDurationMs as number) <= 0 ||
    typeof value.completeAudioCoverage !== "boolean" ||
    !Array.isArray(value.chapters) ||
    !Array.isArray(value.gapChunkIds) ||
    !value.gapChunkIds.every((item) => boundedString(item, 256)) ||
    new Set(value.gapChunkIds).size !== value.gapChunkIds.length ||
    !boundedString(value.modelRevision) ||
    !(
      (value.contextInputSignature === null && value.contextResultJson === null) ||
      (boundedString(value.contextInputSignature) &&
        typeof value.contextResultJson === "string" &&
        value.contextResultJson.length > 0 &&
        value.contextResultJson.length <= 256 * 1024)
    ) ||
    !(
      (value.refinementInputSignature === null &&
        value.refinementCandidatesJson === null) ||
      (boundedString(value.refinementInputSignature) &&
        typeof value.refinementCandidatesJson === "string" &&
        value.refinementCandidatesJson.length > 0 &&
        value.refinementCandidatesJson.length <= 256 * 1024)
    ) ||
    typeof value.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(value.recordedAt))
  ) {
    throw new TypeError("Broadcast context session record is invalid.");
  }
  if (typeof value.contextResultJson === "string") {
    try {
      const parsed: unknown = JSON.parse(value.contextResultJson);
      if (!isRecord(parsed)) throw new TypeError("Context result JSON must be an object.");
    } catch {
      throw new TypeError("Broadcast context result JSON is invalid.");
    }
  }
  if (typeof value.refinementCandidatesJson === "string") {
    try {
      const parsed: unknown = JSON.parse(value.refinementCandidatesJson);
      if (!Array.isArray(parsed)) {
        throw new TypeError("Refinement candidates JSON must be an array.");
      }
    } catch {
      throw new TypeError("Broadcast refinement candidates JSON is invalid.");
    }
  }
  createBroadcastContextRequest({
    sourceDurationMs: value.sourceDurationMs as number,
    chapters: value.chapters as readonly BroadcastContextChapterInput[],
    candidates: [],
  });
}

export function cloneBroadcastContextSessionRecord(
  value: BroadcastContextSessionRecord,
): BroadcastContextSessionRecord {
  assertBroadcastContextSessionRecord(value);
  return {
    ...value,
    chapters: value.chapters.map((chapter) => ({ ...chapter })),
    gapChunkIds: [...value.gapChunkIds],
  };
}
