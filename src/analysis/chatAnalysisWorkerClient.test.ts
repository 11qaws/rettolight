import { describe, expect, it, vi } from "vitest";

import type { ChatAnalysisWorkerRequest } from "./chatAnalysisWorkerProtocol";
import {
  ChatAnalysisWorkerError,
  runChatAnalysisWorker,
  type ChatAnalysisWorkerLike,
} from "./chatAnalysisWorkerClient";
import type { HighlightSelectionResult } from "./highlightSelector";

type WorkerEventType = "message" | "messageerror" | "error";
type WorkerListener = (event: MessageEvent<unknown> | ErrorEvent) => void;

const identity = {
  sessionId: "session-1",
  writerEpoch: 3,
  runId: "run-1",
  workerEpoch: 1,
  workerInstanceId: "worker-1",
  taskId: "task-1",
} as const;

const emptyResult: HighlightSelectionResult = {
  mode: "chat-signals-only",
  candidates: [],
  analyzedMessageCount: 0,
  invalidMessageCount: 0,
  clampedMessageCount: 0,
  outOfRangeMessageCount: 0,
  bucketCount: 1,
  bucketSizeMs: 5000,
};

class FakeWorker implements ChatAnalysisWorkerLike {
  public readonly listeners = new Map<WorkerEventType, Set<WorkerListener>>();
  public request: ChatAnalysisWorkerRequest | null = null;
  public terminateCount = 0;
  public throwOnPost = false;

  public addEventListener(type: WorkerEventType, listener: WorkerListener): void {
    const listeners = this.listeners.get(type) ?? new Set<WorkerListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public removeEventListener(type: WorkerEventType, listener: WorkerListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public postMessage(message: ChatAnalysisWorkerRequest): void {
    if (this.throwOnPost) {
      throw new Error("post failed");
    }
    this.request = message;
  }

  public terminate(): void {
    this.terminateCount += 1;
  }

  public emit(type: WorkerEventType, event: MessageEvent<unknown> | ErrorEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function startWith(worker: FakeWorker, signal?: AbortSignal, timeoutMs?: number) {
  return runChatAnalysisWorker({
    identity,
    messages: [],
    options: { sourceDurationMs: 60_000 },
    ...(signal === undefined ? {} : { signal }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    workerFactory: () => worker,
  });
}

describe("runChatAnalysisWorker", () => {
  it("accepts a correctly fenced result and terminates the worker", async () => {
    const worker = new FakeWorker();
    const promise = startWith(worker);

    expect(worker.request?.identity).toEqual(identity);
    worker.emit(
      "message",
      new MessageEvent("message", {
        data: {
          ...identity,
          eventId: "event-1",
          type: "chat-signals-completed",
          result: emptyResult,
        },
      }),
    );

    await expect(promise).resolves.toEqual(emptyResult);
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects a response from a stale run before exposing its result", async () => {
    const worker = new FakeWorker();
    const promise = startWith(worker);

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: {
          ...identity,
          runId: "stale-run",
          eventId: "event-1",
          type: "chat-signals-completed",
          result: emptyResult,
        },
      }),
    );

    await expect(promise).rejects.toMatchObject({
      code: "EVENT_FENCE_REJECTED",
      fenceReason: "run_id_mismatch",
    });
    expect(worker.terminateCount).toBe(1);
  });

  it("terminates and rejects when the caller cancels", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const promise = startWith(worker, controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: "ABORTED" });
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects and terminates when a response omits its event fence", async () => {
    const worker = new FakeWorker();
    const promise = startWith(worker);

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: {
          type: "chat-signals-completed",
          result: emptyResult,
        },
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: "WORKER_MESSAGE_ERROR" });
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects malformed completed results before exposing them", async () => {
    const worker = new FakeWorker();
    const promise = startWith(worker);

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: {
          ...identity,
          eventId: "event-1",
          type: "chat-signals-completed",
          result: { ...emptyResult, candidates: null },
        },
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: "WORKER_MESSAGE_ERROR" });
    expect(worker.terminateCount).toBe(1);
  });

  it("cleans up and rejects when postMessage throws synchronously", async () => {
    const worker = new FakeWorker();
    worker.throwOnPost = true;

    await expect(startWith(worker)).rejects.toMatchObject({ code: "WORKER_FAILED" });
    expect(worker.terminateCount).toBe(1);
    expect([...worker.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  it("terminates a silent worker after its deadline", async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const promise = startWith(worker, undefined, 1_000);
      const rejection = expect(promise).rejects.toMatchObject({ code: "WORKER_TIMEOUT" });

      await vi.advanceTimersByTimeAsync(1_000);

      await rejection;
      expect(worker.terminateCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not create a worker for an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    let factoryCalls = 0;

    const promise = runChatAnalysisWorker({
      identity,
      messages: [],
      options: { sourceDurationMs: 60_000 },
      signal: controller.signal,
      workerFactory: () => {
        factoryCalls += 1;
        return new FakeWorker();
      },
    });

    await expect(promise).rejects.toBeInstanceOf(ChatAnalysisWorkerError);
    expect(factoryCalls).toBe(0);
  });
});
