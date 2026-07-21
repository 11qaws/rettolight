import { describe, expect, it, vi } from "vitest";
import { runBroadcastTranscriptWorker } from "./broadcastTranscriptWorkerClient";
import type {
  BroadcastTranscriptWorkerRequest,
  BroadcastTranscriptWorkerResponse,
} from "./broadcastTranscriptWorkerProtocol";

class FakeWorker {
  public readonly posted: BroadcastTranscriptWorkerRequest[] = [];
  private readonly listeners = new Map<string, Set<(event: MessageEvent<unknown>) => void>>();
  public postMessage(message: BroadcastTranscriptWorkerRequest): void {
    this.posted.push(message);
  }
  public addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void): void {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }
  public removeEventListener(type: string, listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  public terminate(): void {}
  public emit(message: BroadcastTranscriptWorkerResponse): void {
    for (const listener of this.listeners.get("message") ?? []) {
      listener(new MessageEvent("message", { data: message }));
    }
  }
}

describe("broadcastTranscriptWorkerClient", () => {
  it("collects source-fenced partial results in plan order", async () => {
    const worker = new FakeWorker();
    const chunks = [
      { chunkId: "asr-001", sourceStartMs: 0, sourceEndMs: 1_000, kind: "uniform" as const },
      { chunkId: "asr-002", sourceStartMs: 1_000, sourceEndMs: 2_000, kind: "event" as const },
    ];
    const promise = runBroadcastTranscriptWorker(new File(["x"], "sample.mp4"), {
      sourceDurationMs: 2_000,
      chunks,
      workerFactory: () => worker,
    });
    const analyze = worker.posted[0];
    if (analyze?.type !== "broadcast-transcript-analyze") throw new Error("request");
    const result = (start: number) => ({
      schemaVersion: "1.0.0" as const,
      modelId: "qwen3-asr-flash" as const,
      sourceStartMs: start,
      sourceEndMs: start + 1_000,
      textKo: `대사 ${start}`,
      detectedLanguage: "ko",
      emotion: null,
      billedSeconds: 1,
    });
    worker.emit({ type: "broadcast-transcript-partial", identity: analyze.identity, chunkId: "asr-002", result: result(1_000) });
    worker.emit({ type: "broadcast-transcript-partial", identity: analyze.identity, chunkId: "asr-001", result: result(0) });
    worker.emit({
      type: "broadcast-transcript-complete",
      identity: analyze.identity,
      requestedCount: 2,
      completedCount: 2,
      gapCount: 0,
    });
    await expect(promise).resolves.toMatchObject({
      requestedCount: 2,
      gapChunkIds: [],
      results: [{ sourceStartMs: 0 }, { sourceStartMs: 1_000 }],
    });
  });

  it("rejects a partial result outside its chunk fence", async () => {
    const worker = new FakeWorker();
    const promise = runBroadcastTranscriptWorker(new File(["x"], "sample.mp4"), {
      sourceDurationMs: 2_000,
      chunks: [{ chunkId: "asr-001", sourceStartMs: 0, sourceEndMs: 1_000, kind: "uniform" }],
      workerFactory: () => worker,
    });
    const analyze = worker.posted[0];
    if (analyze?.type !== "broadcast-transcript-analyze") throw new Error("request");
    worker.emit({
      type: "broadcast-transcript-partial",
      identity: analyze.identity,
      chunkId: "asr-001",
      result: {
        schemaVersion: "1.0.0",
        modelId: "qwen3-asr-flash",
        sourceStartMs: 1_000,
        sourceEndMs: 2_000,
        textKo: "잘못된 구간",
        detectedLanguage: "ko",
        emotion: null,
        billedSeconds: 1,
      },
    });
    await expect(promise).rejects.toMatchObject({ code: "WORKER_MESSAGE_ERROR" });
  });

  it("sends a cancellation request and rejects once", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const promise = runBroadcastTranscriptWorker(new File(["x"], "sample.mp4"), {
      sourceDurationMs: 2_000,
      chunks: [{ chunkId: "asr-001", sourceStartMs: 0, sourceEndMs: 1_000, kind: "uniform" }],
      signal: controller.signal,
      workerFactory: () => worker,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: "ABORTED" });
    expect(worker.posted.at(-1)?.type).toBe("broadcast-transcript-cancel");
    expect(vi.fn()).not.toHaveBeenCalled();
  });
});
