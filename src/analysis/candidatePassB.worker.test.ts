import { afterEach, describe, expect, it, vi } from "vitest";

import { CANDIDATE_PASS_B_PROXY_ENDPOINT } from "./candidatePassBGemini";
import {
  CANDIDATE_PASS_B_DEVICE,
  CANDIDATE_PASS_B_GEMINI_MODEL_ID,
  CANDIDATE_PASS_B_GEMINI_MODEL_REVISION,
  CANDIDATE_PASS_B_RESPONSE_MODEL_ID_HEADER,
  CANDIDATE_PASS_B_RESPONSE_MODEL_REVISION_HEADER,
  type CandidatePassBWorkerIdentity,
  type CandidatePassBWorkerRequest,
  type CandidatePassBWorkerResponse,
} from "./candidatePassBWorkerProtocol";

const mediaHarness = vi.hoisted(() => ({ disposedInputCount: 0 }));

vi.mock("mediabunny", () => {
  class FakeInputDisposedError extends Error {}
  class FakeUnsupportedInputFormatError extends Error {}
  class FakeBlobSource {
    public constructor() {}
  }
  class FakeInput {
    public constructor() {}

    public getPrimaryAudioTrack() {
      return Promise.resolve({ canDecode: () => Promise.resolve(true) });
    }

    public dispose(): void {
      mediaHarness.disposedInputCount += 1;
    }
  }
  class FakeAudioSampleSink {
    public constructor() {}

    public async *samples() {
      await Promise.resolve();
      const numberOfFrames = 16_000 * 30;
      yield {
        numberOfFrames,
        numberOfChannels: 1,
        sampleRate: 16_000,
        timestamp: 0,
        duration: 30,
        copyTo(destination: Float32Array): void {
          for (let index = 0; index < numberOfFrames; index += 1) {
            destination[index] =
              Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.08;
          }
        },
        close(): void {},
      };
    }
  }
  return {
    ALL_FORMATS: [],
    AudioSampleSink: FakeAudioSampleSink,
    BlobSource: FakeBlobSource,
    Input: FakeInput,
    InputDisposedError: FakeInputDisposedError,
    UnsupportedInputFormatError: FakeUnsupportedInputFormatError,
  };
});

const identity: CandidatePassBWorkerIdentity = {
  sessionId: "session-1",
  writerEpoch: 1,
  analysisRunId: "analysis-1",
  passBRunId: "pass-b-1",
  workerEpoch: 1,
  workerInstanceId: "worker-1",
  taskId: "task-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  mediaHarness.disposedInputCount = 0;
});

describe("candidatePassB.worker remote lifecycle", () => {
  it("posts only candidate audio to the fixed proxy and aborts before acknowledging cancellation", async () => {
    let messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
    const responses: CandidatePassBWorkerResponse[] = [];
    const fakeSelf = {
      crypto: globalThis.crypto,
      addEventListener(
        type: string,
        handler: (event: MessageEvent<unknown>) => void,
      ): void {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      postMessage(message: CandidatePassBWorkerResponse): void {
        responses.push(message);
      },
    };
    let fetchSignal: AbortSignal | null = null;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          fetchSignal = init?.signal ?? null;
          fetchSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("self", fakeSelf);
    vi.stubGlobal("fetch", fetchMock);

    await import("./candidatePassB.worker");
    expect(messageHandler).not.toBeNull();

    const analyzeRequest: CandidatePassBWorkerRequest = {
      type: "candidate-pass-b-analyze",
      identity,
      file: new File([new Uint8Array([1])], "source.mp4"),
      sourceDurationMs: 30_000,
      device: CANDIDATE_PASS_B_DEVICE,
      targets: [{ candidateId: "candidate-1", startMs: 0, endMs: 30_000 }],
    };
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", { data: analyzeRequest }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(CANDIDATE_PASS_B_PROXY_ENDPOINT);
    expect(firstCall?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const rawProxyBody = firstCall?.[1]?.body;
    expect(typeof rawProxyBody).toBe("string");
    if (typeof rawProxyBody !== "string") {
      throw new TypeError("Expected a serialized proxy request body.");
    }
    const proxyBody = JSON.parse(rawProxyBody) as Record<string, unknown>;
    expect(Object.keys(proxyBody)).toEqual(["audioBase64", "candidateDurationMs"]);
    expect(proxyBody.candidateDurationMs).toBe(30_000);
    expect(proxyBody.audioBase64).toEqual(expect.stringMatching(/^UklGR/));
    expect((fetchSignal as AbortSignal | null)?.aborted).toBe(false);

    const cancelRequest: CandidatePassBWorkerRequest = {
      type: "candidate-pass-b-cancel",
      identity,
    };
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", { data: cancelRequest }),
    );

    expect((fetchSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(
      responses.some(
        (response) => response.type === "candidate-pass-b-cancel-acknowledged",
      ),
    ).toBe(true);
    await vi.waitFor(() => expect(mediaHarness.disposedInputCount).toBe(1));
    expect(
      responses.some((response) => response.type === "candidate-pass-b-failed"),
    ).toBe(false);
  });

  it("isolates a proxy-invalid Gemini response as one candidate gap and continues", async () => {
    let messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
    const responses: CandidatePassBWorkerResponse[] = [];
    const fakeSelf = {
      crypto: globalThis.crypto,
      addEventListener(
        type: string,
        handler: (event: MessageEvent<unknown>) => void,
      ): void {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      postMessage(message: CandidatePassBWorkerResponse): void {
        responses.push(message);
      },
    };
    const validAnalysis = {
      segments: [
        { relativeStartMs: 1_000, relativeEndMs: 2_000, text: "정말 대박" },
      ],
      eventSummaryKo: "짧은 한국어 발화가 들려요.",
      reactionSummaryKo: "목소리가 잠시 커지는 반응 단서가 들려요.",
      whyGoodClipKo: "발화와 소리 변화가 가까워 먼저 확인할 만해요.",
      uncertaintiesKo: ["화자와 화면 사건은 오디오만으로 알 수 없어요."],
      participantPresence: "insufficient-evidence",
      participantSummaryKo: "대표 화면이 없어 등장인물을 확인하지 못했습니다.",
      identifiedParticipants: [],
    };
    const fetchMock = vi
      .fn<(_input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "UPSTREAM_INVALID_RESPONSE",
              message: "Gemini 응답을 확인하지 못했어요.",
            },
          }),
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify(validAnalysis) }] },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              [CANDIDATE_PASS_B_RESPONSE_MODEL_ID_HEADER]:
                CANDIDATE_PASS_B_GEMINI_MODEL_ID,
              [CANDIDATE_PASS_B_RESPONSE_MODEL_REVISION_HEADER]:
                CANDIDATE_PASS_B_GEMINI_MODEL_REVISION,
            },
          },
        ),
      );
    vi.stubGlobal("self", fakeSelf);
    vi.stubGlobal("fetch", fetchMock);

    await import("./candidatePassB.worker");
    const analyzeRequest: CandidatePassBWorkerRequest = {
      type: "candidate-pass-b-analyze",
      identity,
      file: new File([new Uint8Array([1])], "source.mp4"),
      sourceDurationMs: 30_000,
      device: CANDIDATE_PASS_B_DEVICE,
      targets: [
        { candidateId: "candidate-1", startMs: 0, endMs: 30_000 },
        { candidateId: "candidate-2", startMs: 0, endMs: 30_000 },
      ],
    };
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", { data: analyzeRequest }),
    );

    await vi.waitFor(() =>
      expect(
        responses.some((response) => response.type === "candidate-pass-b-completed"),
      ).toBe(true),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      responses.find((response) => response.type === "candidate-pass-b-candidate-gap"),
    ).toMatchObject({
      gap: { candidateId: "candidate-1", reasonCode: "TRANSCRIPTION_FAILED" },
    });
    expect(
      responses.find((response) => response.type === "candidate-pass-b-partial-result"),
    ).toMatchObject({
      result: {
        candidateId: "candidate-2",
        model: {
          id: CANDIDATE_PASS_B_GEMINI_MODEL_ID,
          revision: CANDIDATE_PASS_B_GEMINI_MODEL_REVISION,
        },
      },
    });
    expect(
      responses.find((response) => response.type === "candidate-pass-b-completed"),
    ).toMatchObject({
      summary: { requestedCount: 2, completedCount: 1, gapCount: 1 },
    });
    expect(
      responses.some((response) => response.type === "candidate-pass-b-failed"),
    ).toBe(false);
  });

  it("starts the next candidate request before the previous Gemini response arrives", async () => {
    let messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
    const responses: CandidatePassBWorkerResponse[] = [];
    const deferredResponses: Array<(response: Response) => void> = [];
    const validAnalysis = {
      segments: [
        { relativeStartMs: 1_000, relativeEndMs: 2_000, text: "테스트 발화" },
      ],
      eventSummaryKo: "후보 사건 요약",
      reactionSummaryKo: "스트리머 반응 요약",
      whyGoodClipKo: "반응이 분명한 후보",
      uncertaintiesKo: ["화면 맥락은 재생 확인이 필요합니다."],
      participantPresence: "insufficient-evidence",
      participantSummaryKo: "대표 화면이 없어 등장인물을 확인하지 못했습니다.",
      identifiedParticipants: [],
    };
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferredResponses.push(resolve);
        }),
    );
    vi.stubGlobal("self", {
      crypto: globalThis.crypto,
      addEventListener(
        type: string,
        handler: (event: MessageEvent<unknown>) => void,
      ): void {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      postMessage(message: CandidatePassBWorkerResponse): void {
        responses.push(message);
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await import("./candidatePassB.worker");
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", {
        data: {
          type: "candidate-pass-b-analyze",
          identity,
          file: new File([new Uint8Array([1])], "source.mp4"),
          sourceDurationMs: 60_000,
          device: CANDIDATE_PASS_B_DEVICE,
          targets: [
            { candidateId: "candidate-1", startMs: 0, endMs: 30_000 },
            { candidateId: "candidate-2", startMs: 0, endMs: 30_000 },
          ],
        } satisfies CandidatePassBWorkerRequest,
      }),
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(deferredResponses).toHaveLength(2);
    for (const resolve of deferredResponses) {
      resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify(validAnalysis) }] },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }
    await vi.waitFor(() =>
      expect(
        responses.some((response) => response.type === "candidate-pass-b-completed"),
      ).toBe(true),
    );
    expect(
      responses.find((response) => response.type === "candidate-pass-b-completed"),
    ).toMatchObject({ summary: { requestedCount: 2, completedCount: 2, gapCount: 0 } });
  });

  it("maps a network rejection to a key-free safe Worker failure", async () => {
    let messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
    const responses: CandidatePassBWorkerResponse[] = [];
    vi.stubGlobal("self", {
      crypto: globalThis.crypto,
      addEventListener(
        type: string,
        handler: (event: MessageEvent<unknown>) => void,
      ): void {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      postMessage(message: CandidatePassBWorkerResponse): void {
        responses.push(message);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error("raw network detail containing private infrastructure detail"),
      ),
    );

    await import("./candidatePassB.worker");
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", {
        data: {
          type: "candidate-pass-b-analyze",
          identity,
          file: new File([new Uint8Array([1])], "source.mp4"),
          sourceDurationMs: 30_000,
          device: CANDIDATE_PASS_B_DEVICE,
          targets: [{ candidateId: "candidate-1", startMs: 0, endMs: 30_000 }],
        } satisfies CandidatePassBWorkerRequest,
      }),
    );

    await vi.waitFor(() =>
      expect(
        responses.some((response) => response.type === "candidate-pass-b-failed"),
      ).toBe(true),
    );
    const failure = responses.find(
      (response) => response.type === "candidate-pass-b-failed",
    );
    expect(failure).toMatchObject({ reasonCode: "PROXY_UNAVAILABLE" });
    expect(JSON.stringify(failure)).not.toContain("private infrastructure detail");
    expect(JSON.stringify(failure)).not.toContain("raw network detail");
  });

  it("rejects a candidate longer than sixty seconds before decoding or sending", async () => {
    let messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
    const responses: CandidatePassBWorkerResponse[] = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("self", {
      crypto: globalThis.crypto,
      addEventListener(
        type: string,
        handler: (event: MessageEvent<unknown>) => void,
      ): void {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      postMessage(message: CandidatePassBWorkerResponse): void {
        responses.push(message);
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await import("./candidatePassB.worker");
    (messageHandler as ((event: MessageEvent<unknown>) => void) | null)?.(
      new MessageEvent("message", {
        data: {
          type: "candidate-pass-b-analyze",
          identity,
          file: new File([new Uint8Array([1])], "source.mp4"),
          sourceDurationMs: 180_000,
          device: CANDIDATE_PASS_B_DEVICE,
          targets: [
            { candidateId: "candidate-too-long", startMs: 0, endMs: 60_001 },
          ],
        },
      }),
    );

    await vi.waitFor(() =>
      expect(
        responses.some((response) => response.type === "candidate-pass-b-failed"),
      ).toBe(true),
    );
    expect(responses[0]).toMatchObject({ reasonCode: "INVALID_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mediaHarness.disposedInputCount).toBe(0);
  });
});
