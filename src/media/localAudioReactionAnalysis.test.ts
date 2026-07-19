import { describe, expect, it, vi } from "vitest";

import type {
  AudioReactionWorkerIdentity,
  AudioReactionWorkerRequest,
  AudioReactionWorkerResponsePayload,
  LocalAudioReactionUnavailableResult,
} from "./audioReactionWorkerProtocol";
import {
  LocalAudioReactionAnalysisError,
  analyzeLocalAudioReactions,
  type LocalAudioReactionAnalysisProgress,
  type LocalAudioReactionAnalysisResult,
  type LocalAudioReactionWorkerLike,
} from "./localAudioReactionAnalysis";

type WorkerEventType = "message" | "messageerror" | "error";
type WorkerListener = (event: MessageEvent<unknown> | ErrorEvent) => void;

const identity = {
  sessionId: "session-audio-1",
  writerEpoch: 5,
  runId: "run-audio-1",
  workerEpoch: 2,
  workerInstanceId: "worker-audio-2",
  taskId: "task-audio-9",
} as const;

const completeResult: LocalAudioReactionAnalysisResult = {
  mode: "local-audio-reaction-fast-pass",
  sourceDurationMs: 60_000,
  plannedWindowCount: 60,
  analyzedWindowCount: 60,
  coverageComplete: true,
  candidateWindowMs: 45_000,
  candidates: [],
  diagnostics: {
    medianWindowDurationMs: 1_000,
    sourceMedianRms: 0.04,
    sourceMedianPeak: 0.2,
    silenceWindowCount: 2,
    impulseLikeWindowCount: 1,
    suppressedSustainedBackgroundCount: 1,
    eligibleEventCount: 0,
  },
};

const unavailableResult: LocalAudioReactionUnavailableResult = {
  mode: "local-audio-reaction-unavailable",
  sourceDurationMs: 60_000,
  featureWindowMs: 1_000,
  plannedWindowCount: 60,
  analyzedWindowCount: 0,
  coverageComplete: false,
  candidates: [],
  reasonCode: "NO_AUDIO_TRACK",
};

const decodingProgress: LocalAudioReactionAnalysisProgress = {
  stage: "decoding-audio",
  decodedThroughMs: 30_000,
  sourceDurationMs: 60_000,
  analyzedWindowCount: 30,
  ratio: 0.485,
};

class FakeWorker implements LocalAudioReactionWorkerLike {
  public readonly listeners = new Map<WorkerEventType, Set<WorkerListener>>();
  public readonly requests: AudioReactionWorkerRequest[] = [];
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

  public postMessage(message: AudioReactionWorkerRequest): void {
    if (this.throwOnPost) {
      throw new Error("post failed");
    }
    this.requests.push(message);
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

let eventSequence = 0;

function emitResponse(
  worker: FakeWorker,
  payload: AudioReactionWorkerResponsePayload,
  identityOverride: Partial<AudioReactionWorkerIdentity> = {},
): void {
  eventSequence += 1;
  worker.emit(
    "message",
    new MessageEvent("message", {
      data: {
        ...identity,
        ...identityOverride,
        eventId: `audio-event-${eventSequence}`,
        ...payload,
      },
    }),
  );
}

function fakeVideoFile(): File {
  return {
    name: "private-stream.mp4",
    size: 12_345,
    type: "video/mp4",
  } as File;
}

function startWith(
  worker: FakeWorker,
  overrides: Partial<Parameters<typeof analyzeLocalAudioReactions>[1]> = {},
) {
  return analyzeLocalAudioReactions(fakeVideoFile(), {
    identity,
    sourceDurationMs: 60_000,
    workerFactory: () => worker,
    ...overrides,
  });
}

describe("analyzeLocalAudioReactions", () => {
  it("forwards monotonic progress and accepts a correctly fenced result", async () => {
    const worker = new FakeWorker();
    const progress: LocalAudioReactionAnalysisProgress[] = [];
    const pending = startWith(worker, {
      selection: { maxCandidates: 6 },
      onProgress: (update) => progress.push(update),
    });

    expect(worker.requests[0]).toMatchObject({
      type: "analyze-audio-reactions",
      identity,
      sourceDurationMs: 60_000,
      options: { maxCandidates: 6 },
    });
    emitResponse(worker, {
      type: "audio-reaction-progress",
      progress: decodingProgress,
    });
    emitResponse(worker, {
      type: "audio-reaction-completed",
      result: completeResult,
    });

    await expect(pending).resolves.toEqual(completeResult);
    expect(progress).toEqual([decodingProgress]);
    expect(worker.terminateCount).toBe(1);
    expect([...worker.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  it("returns no-track and unsupported-media states as recoverable unavailable outcomes", async () => {
    const worker = new FakeWorker();
    const pending = startWith(worker);

    emitResponse(worker, {
      type: "audio-reaction-unavailable",
      result: unavailableResult,
    });

    await expect(pending).resolves.toEqual(unavailableResult);
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects a response from a stale run before exposing it", async () => {
    const worker = new FakeWorker();
    const pending = startWith(worker);

    emitResponse(
      worker,
      { type: "audio-reaction-completed", result: completeResult },
      { runId: "stale-run" },
    );

    await expect(pending).rejects.toMatchObject({
      code: "EVENT_FENCE_REJECTED",
      fenceReason: "run_id_mismatch",
    });
    expect(worker.terminateCount).toBe(1);
  });

  it("sends a cooperative cancel and waits for its acknowledgement before terminating", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const pending = startWith(worker, { signal: controller.signal });
    let settled = false;
    void pending.finally(() => {
      settled = true;
    }).catch(() => undefined);

    controller.abort();
    await Promise.resolve();

    expect(worker.requests.at(-1)).toEqual({
      type: "cancel-audio-reactions",
      identity,
    });
    expect(worker.terminateCount).toBe(0);
    expect(settled).toBe(false);

    emitResponse(worker, { type: "audio-reaction-cancel-acknowledged" });

    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    expect(worker.terminateCount).toBe(1);
  });

  it("force-terminates a worker that does not acknowledge cancellation", async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const controller = new AbortController();
      const pending = startWith(worker, {
        signal: controller.signal,
        cancelAcknowledgementTimeoutMs: 100,
      });
      const rejection = expect(pending).rejects.toMatchObject({ code: "ABORTED" });

      controller.abort();
      await vi.advanceTimersByTimeAsync(100);

      await rejection;
      expect(worker.terminateCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the same cancel handshake when the overall deadline expires", async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const pending = startWith(worker, { timeoutMs: 250 });
      const rejection = expect(pending).rejects.toMatchObject({
        code: "WORKER_TIMEOUT",
      });

      await vi.advanceTimersByTimeAsync(250);
      expect(worker.requests.at(-1)?.type).toBe("cancel-audio-reactions");
      emitResponse(worker, { type: "audio-reaction-cancel-acknowledged" });

      await rejection;
      expect(worker.terminateCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels if a progress callback throws and does not expose a later result", async () => {
    const worker = new FakeWorker();
    const pending = startWith(worker, {
      onProgress: () => {
        throw new Error("render failed");
      },
    });

    emitResponse(worker, {
      type: "audio-reaction-progress",
      progress: decodingProgress,
    });
    expect(worker.requests.at(-1)?.type).toBe("cancel-audio-reactions");
    emitResponse(worker, { type: "audio-reaction-cancel-acknowledged" });

    await expect(pending).rejects.toMatchObject({
      code: "PROGRESS_CALLBACK_FAILED",
    });
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects malformed evidence instead of exposing a corrupt candidate", async () => {
    const worker = new FakeWorker();
    const pending = startWith(worker);
    const corrupt = {
      ...completeResult,
      candidates: [
        {
          id: "audio-corrupt",
          peakMs: 30_000,
          startMs: 3_000,
          endMs: 48_000,
          score: 4,
          reason: "corrupt fixture",
          evidence: {
            eventKind: "explosion",
            baselineRms: 0.1,
            medianAbsoluteDeviation: 0.01,
            robustLoudnessScore: 4,
            rmsLiftRatio: 3,
            peakLiftRatio: 2,
            sustainedWindowCount: 3,
            activeWindowCount: 2,
            clickPenalty: 0,
            backgroundPenalty: 0,
            zeroCrossingRate: 0.2,
            speechBandEnergyRatio: 0.6,
          },
        },
      ],
    };

    emitResponse(worker, {
      type: "audio-reaction-completed",
      result: corrupt as LocalAudioReactionAnalysisResult,
    });

    await expect(pending).rejects.toMatchObject({ code: "WORKER_MESSAGE_ERROR" });
    expect(worker.terminateCount).toBe(1);
  });

  it("does not create a worker when the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let factoryCalls = 0;

    const pending = analyzeLocalAudioReactions(fakeVideoFile(), {
      identity,
      sourceDurationMs: 60_000,
      signal: controller.signal,
      workerFactory: () => {
        factoryCalls += 1;
        return new FakeWorker();
      },
    });

    await expect(pending).rejects.toBeInstanceOf(LocalAudioReactionAnalysisError);
    expect(factoryCalls).toBe(0);
  });
});
