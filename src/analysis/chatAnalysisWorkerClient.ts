import {
  createEventFence,
  fenceEvent,
  type EventFenceRejectionReason,
} from "../domain/eventFence";
import type {
  ChatAnalysisWorkerIdentity,
  ChatAnalysisWorkerRequest,
  ChatAnalysisWorkerResponse,
} from "./chatAnalysisWorkerProtocol";
import type { NormalizedChatMessage } from "./chatImport";
import type {
  HighlightSelectionOptions,
  HighlightSelectionResult,
} from "./highlightSelector";

type WorkerEventType = "message" | "messageerror" | "error";
type WorkerListener = (event: MessageEvent<unknown> | ErrorEvent) => void;

export interface ChatAnalysisWorkerLike {
  addEventListener(type: WorkerEventType, listener: WorkerListener): void;
  removeEventListener(type: WorkerEventType, listener: WorkerListener): void;
  postMessage(message: ChatAnalysisWorkerRequest): void;
  terminate(): void;
}

export type ChatAnalysisWorkerFactory = () => ChatAnalysisWorkerLike;

export interface RunChatAnalysisWorkerInput {
  readonly identity: ChatAnalysisWorkerIdentity;
  readonly messages: readonly NormalizedChatMessage[];
  readonly options: HighlightSelectionOptions;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly workerFactory?: ChatAnalysisWorkerFactory;
}

export class ChatAnalysisWorkerError extends Error {
  public readonly code:
    | "ABORTED"
    | "EVENT_FENCE_REJECTED"
    | "WORKER_FAILED"
    | "WORKER_MESSAGE_ERROR"
    | "WORKER_TIMEOUT";
  public readonly fenceReason: EventFenceRejectionReason | null;

  public constructor(
    code: ChatAnalysisWorkerError["code"],
    message: string,
    fenceReason: EventFenceRejectionReason | null = null,
  ) {
    super(message);
    this.name = "ChatAnalysisWorkerError";
    this.code = code;
    this.fenceReason = fenceReason;
  }
}

export function createBrowserChatAnalysisWorker(): ChatAnalysisWorkerLike {
  return new Worker(new URL("./chatAnalysis.worker.ts", import.meta.url), {
    type: "module",
    name: "retto-chat-signals",
  });
}

const DEFAULT_CHAT_WORKER_TIMEOUT_MS = 60_000;

function normalizeWorkerTimeout(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_CHAT_WORKER_TIMEOUT_MS;
  }
  return Number.isFinite(value)
    ? Math.min(5 * 60_000, Math.max(1, Math.round(value)))
    : DEFAULT_CHAT_WORKER_TIMEOUT_MS;
}

function isWorkerResponse(value: unknown): value is ChatAnalysisWorkerResponse {
  if (!isRecord(value) || !isFenceEnvelope(value)) {
    return false;
  }
  if (value.type === "chat-signals-completed") {
    return isHighlightSelectionResult(value.result);
  }
  return (
    value.type === "chat-signals-failed" &&
    value.reasonCode === "SIGNAL_ENGINE_FAILED" &&
    typeof value.message === "string" &&
    value.message.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFenceEnvelope(value: Record<string, unknown>): boolean {
  return (
    typeof value.eventId === "string" &&
    typeof value.sessionId === "string" &&
    Number.isSafeInteger(value.writerEpoch) &&
    typeof value.runId === "string" &&
    Number.isSafeInteger(value.workerEpoch) &&
    typeof value.workerInstanceId === "string" &&
    typeof value.taskId === "string"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function hasFiniteNumberFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => isFiniteNumber(value[field]));
}

function isChatCandidate(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.evidence)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.reason === "string" &&
    isFiniteNumber(value.peakMs) &&
    isFiniteNumber(value.startMs) &&
    isFiniteNumber(value.endMs) &&
    value.startMs >= 0 &&
    value.endMs >= value.startMs &&
    isFiniteNumber(value.score) &&
    hasFiniteNumberFields(value.evidence, [
      "bucketStartMs",
      "bucketEndMs",
      "messageCount",
      "uniqueAuthorCount",
      "reactionMessageCount",
      "baselineMessageCount",
      "baselineUniqueAuthorCount",
      "burstRatio",
      "robustBurstScore",
      "repetitionRatio",
      "singleAuthorRatio",
      "spamPenalty",
    ])
  );
}

function isHighlightSelectionResult(value: unknown): value is HighlightSelectionResult {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return false;
  }
  return (
    value.mode === "chat-signals-only" &&
    value.candidates.every(isChatCandidate) &&
    isNonNegativeInteger(value.analyzedMessageCount) &&
    isNonNegativeInteger(value.invalidMessageCount) &&
    isNonNegativeInteger(value.clampedMessageCount) &&
    isNonNegativeInteger(value.outOfRangeMessageCount) &&
    isNonNegativeInteger(value.bucketCount) &&
    value.bucketSizeMs === 5000
  );
}

export function runChatAnalysisWorker(
  input: RunChatAnalysisWorkerInput,
): Promise<HighlightSelectionResult> {
  if (input.signal?.aborted === true) {
    return Promise.reject(
      new ChatAnalysisWorkerError("ABORTED", "Chat signal analysis was cancelled before it started."),
    );
  }

  let worker: ChatAnalysisWorkerLike;
  try {
    worker = (input.workerFactory ?? createBrowserChatAnalysisWorker)();
  } catch {
    return Promise.reject(
      new ChatAnalysisWorkerError("WORKER_FAILED", "The analysis worker could not be created."),
    );
  }
  let fence = createEventFence(input.identity);
  const timeoutMs = normalizeWorkerTimeout(input.timeoutMs);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): boolean => {
      let succeeded = true;
      const attempt = (operation: () => void): void => {
        try {
          operation();
        } catch {
          succeeded = false;
        }
      };
      attempt(() => worker.removeEventListener("message", handleMessage));
      attempt(() => worker.removeEventListener("messageerror", handleMessageError));
      attempt(() => worker.removeEventListener("error", handleWorkerError));
      attempt(() => input.signal?.removeEventListener("abort", handleAbort));
      if (timeoutHandle !== null) {
        const handle = timeoutHandle;
        attempt(() => globalThis.clearTimeout(handle));
        timeoutHandle = null;
      }
      attempt(() => worker.terminate());
      return succeeded;
    };

    const finish = (
      outcome:
        | { readonly ok: true; readonly result: HighlightSelectionResult }
        | { readonly ok: false; readonly error: ChatAnalysisWorkerError },
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      const cleanupSucceeded = cleanup();
      if (!cleanupSucceeded && outcome.ok) {
        reject(
          new ChatAnalysisWorkerError(
            "WORKER_FAILED",
            "The analysis worker result arrived, but its resources could not be fully released.",
          ),
        );
        return;
      }
      if (outcome.ok) {
        resolve(outcome.result);
      } else {
        reject(outcome.error);
      }
    };

    const handleMessage = (event: MessageEvent<unknown> | ErrorEvent): void => {
      try {
        if (!(event instanceof MessageEvent) || !isWorkerResponse(event.data)) {
          finish({
            ok: false,
            error: new ChatAnalysisWorkerError(
              "WORKER_MESSAGE_ERROR",
              "The analysis worker returned an unsupported message.",
            ),
          });
          return;
        }

        const fenced = fenceEvent(fence, event.data);
        if (!fenced.accepted) {
          finish({
            ok: false,
            error: new ChatAnalysisWorkerError(
              "EVENT_FENCE_REJECTED",
              `The analysis worker event was rejected: ${fenced.reason}`,
              fenced.reason,
            ),
          });
          return;
        }
        fence = fenced.state;

        if (event.data.type === "chat-signals-failed") {
          finish({
            ok: false,
            error: new ChatAnalysisWorkerError("WORKER_FAILED", event.data.message),
          });
          return;
        }
        finish({ ok: true, result: event.data.result });
      } catch {
        finish({
          ok: false,
          error: new ChatAnalysisWorkerError(
            "WORKER_MESSAGE_ERROR",
            "The analysis worker returned a malformed message.",
          ),
        });
      }
    };

    const handleMessageError = (): void => {
      finish({
        ok: false,
        error: new ChatAnalysisWorkerError(
          "WORKER_MESSAGE_ERROR",
          "The browser could not read the analysis worker result.",
        ),
      });
    };

    const handleWorkerError = (event: MessageEvent<unknown> | ErrorEvent): void => {
      finish({
        ok: false,
        error: new ChatAnalysisWorkerError(
          "WORKER_FAILED",
          event instanceof ErrorEvent && event.message.length > 0
            ? event.message
            : "The analysis worker stopped unexpectedly.",
        ),
      });
    };

    const handleAbort = (): void => {
      finish({
        ok: false,
        error: new ChatAnalysisWorkerError("ABORTED", "Chat signal analysis was cancelled."),
      });
    };

    try {
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("messageerror", handleMessageError);
      worker.addEventListener("error", handleWorkerError);
      input.signal?.addEventListener("abort", handleAbort, { once: true });
      timeoutHandle = globalThis.setTimeout(() => {
        finish({
          ok: false,
          error: new ChatAnalysisWorkerError(
            "WORKER_TIMEOUT",
            "The analysis worker did not answer before its deadline.",
          ),
        });
      }, timeoutMs);

      worker.postMessage({
        type: "analyze-chat-signals",
        identity: input.identity,
        messages: input.messages,
        options: input.options,
      });
    } catch {
      finish({
        ok: false,
        error: new ChatAnalysisWorkerError(
          "WORKER_FAILED",
          "The analysis worker could not receive its input.",
        ),
      });
    }
  });
}
