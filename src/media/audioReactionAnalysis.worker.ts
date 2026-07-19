/// <reference lib="webworker" />

import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  Input,
  InputDisposedError,
  UnsupportedInputFormatError,
  type AudioSample,
} from "mediabunny";

import {
  selectAudioReactionHighlights,
  type AudioReactionFeatureWindow,
} from "./localAudioReactionAnalysisCore";
import {
  AUDIO_REACTION_FEATURE_WINDOW_MS,
  type AudioReactionWorkerIdentity,
  type AudioReactionWorkerRequest,
  type AudioReactionWorkerResponse,
  type AudioReactionWorkerResponsePayload,
  type LocalAudioReactionAnalysisOutcome,
  type LocalAudioReactionAnalysisProgress,
  type LocalAudioReactionUnavailableReason,
  type LocalAudioReactionUnavailableResult,
} from "./audioReactionWorkerProtocol";

declare const self: DedicatedWorkerGlobalScope;

const SOURCE_CACHE_BYTES = 8 * 1024 * 1024;
const FEATURE_SAMPLE_RATE_HZ = 8_000;
const SPEECH_BAND_LOW_HZ = 300;
const SPEECH_BAND_HIGH_HZ = 3_400;
const PROGRESS_MIN_REAL_INTERVAL_MS = 150;
const PROGRESS_MIN_RATIO_STEP = 0.005;

interface ActiveAudioTask {
  readonly identity: AudioReactionWorkerIdentity;
  cancelled: boolean;
  input: Input<BlobSource> | null;
  inputWasDisposed: boolean;
}

interface MutableFeatureWindow {
  readonly startMs: number;
  readonly endMs: number;
  sampleCount: number;
  sumSquares: number;
  peak: number;
  zeroCrossingCount: number;
  previousValue: number | null;
  speechBandEnergy: number;
  totalFilterEnergy: number;
}

class SignalEngineFailure extends Error {
  public constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Audio reaction scoring failed.", {
      cause,
    });
    this.name = "SignalEngineFailure";
  }
}

class AudioFeatureAccumulator {
  private readonly windows = new Map<number, MutableFeatureWindow>();
  private channelPlaneScratch = new Float32Array(0);
  private downmixedScratch = new Float32Array(0);
  private frameEnergyScratch = new Float32Array(0);
  private framePeakScratch = new Float32Array(0);
  private filterSampleRateHz = 0;
  private previousFilterInput = 0;
  private previousHighPass = 0;
  private previousLowPass = 0;

  public constructor(private readonly sourceDurationMs: number) {}

  public consume(sample: AudioSample): void {
    if (sample.numberOfFrames === 0 || sample.numberOfChannels === 0) {
      return;
    }

    const stride = Math.max(1, Math.ceil(sample.sampleRate / FEATURE_SAMPLE_RATE_HZ));
    const sampledFrameCount = Math.ceil(sample.numberOfFrames / stride);
    this.ensureScratchCapacity(sample.numberOfFrames, sampledFrameCount);
    const downmixed = this.downmixedScratch.subarray(0, sampledFrameCount);
    const frameEnergy = this.frameEnergyScratch.subarray(0, sampledFrameCount);
    const framePeak = this.framePeakScratch.subarray(0, sampledFrameCount);
    const channelPlane = this.channelPlaneScratch.subarray(0, sample.numberOfFrames);
    downmixed.fill(0);
    frameEnergy.fill(0);
    framePeak.fill(0);

    for (let channelIndex = 0; channelIndex < sample.numberOfChannels; channelIndex += 1) {
      sample.copyTo(channelPlane, {
        planeIndex: channelIndex,
        format: "f32-planar",
      });
      for (
        let sourceFrame = 0, targetFrame = 0;
        sourceFrame < sample.numberOfFrames;
        sourceFrame += stride, targetFrame += 1
      ) {
        const channelValue = channelPlane[sourceFrame] ?? 0;
        downmixed[targetFrame] =
          (downmixed[targetFrame] ?? 0) +
          channelValue / sample.numberOfChannels;
        frameEnergy[targetFrame] =
          (frameEnergy[targetFrame] ?? 0) +
          (channelValue * channelValue) / sample.numberOfChannels;
        framePeak[targetFrame] = Math.max(
          framePeak[targetFrame] ?? 0,
          Math.abs(channelValue),
        );
      }
    }

    const effectiveSampleRateHz = sample.sampleRate / stride;
    this.ensureFilterRate(effectiveSampleRateHz);
    for (let frameIndex = 0; frameIndex < downmixed.length; frameIndex += 1) {
      const timestampMs =
        (sample.timestamp + (frameIndex * stride) / sample.sampleRate) * 1_000;
      if (timestampMs < 0 || timestampMs >= this.sourceDurationMs) {
        continue;
      }
      this.addValue(
        timestampMs,
        downmixed[frameIndex] ?? 0,
        frameEnergy[frameIndex] ?? 0,
        framePeak[frameIndex] ?? 0,
        effectiveSampleRateHz,
      );
    }
  }

  public analyzedWindowCount(decodedThroughMs: number): number {
    return Math.min(
      Math.ceil(this.sourceDurationMs / AUDIO_REACTION_FEATURE_WINDOW_MS),
      Math.max(0, Math.ceil(decodedThroughMs / AUDIO_REACTION_FEATURE_WINDOW_MS)),
    );
  }

  public finish(): readonly AudioReactionFeatureWindow[] {
    const totalWindowCount = Math.ceil(
      this.sourceDurationMs / AUDIO_REACTION_FEATURE_WINDOW_MS,
    );
    const completed: AudioReactionFeatureWindow[] = [];

    for (let windowIndex = 0; windowIndex < totalWindowCount; windowIndex += 1) {
      const window = this.windows.get(windowIndex);
      if (window === undefined || window.sampleCount === 0) {
        // An absent decoded window is a coverage gap, not evidence of silence.
        // Real encoded silence still produces samples and therefore reaches the
        // aggregate path below with zero-valued energy.
        continue;
      }

      const speechBandEnergyRatio =
        window.totalFilterEnergy > 0
          ? clamp(window.speechBandEnergy / window.totalFilterEnergy, 0, 1)
          : 0;
      completed.push({
        startMs: window.startMs,
        endMs: window.endMs,
        rms: round(clamp(Math.sqrt(window.sumSquares / window.sampleCount), 0, 1), 6),
        peak: round(clamp(window.peak, 0, 1), 6),
        zeroCrossingRate: round(
          window.sampleCount > 1
            ? window.zeroCrossingCount / (window.sampleCount - 1)
            : 0,
          6,
        ),
        speechBandEnergyRatio: round(speechBandEnergyRatio, 6),
      });
    }

    return completed;
  }

  private addValue(
    timestampMs: number,
    rawValue: number,
    rawEnergySquare: number,
    rawPeak: number,
    effectiveSampleRateHz: number,
  ): void {
    const value = clamp(Number.isFinite(rawValue) ? rawValue : 0, -1, 1);
    const energySquare = clamp(
      Number.isFinite(rawEnergySquare) ? rawEnergySquare : 0,
      0,
      1,
    );
    const absolutePeak = clamp(Number.isFinite(rawPeak) ? rawPeak : 0, 0, 1);
    const windowIndex = Math.floor(timestampMs / AUDIO_REACTION_FEATURE_WINDOW_MS);
    const window = this.getOrCreateWindow(windowIndex);

    window.sampleCount += 1;
    // Energy and peak are accumulated per channel before downmixing so
    // anti-phase stereo cannot erase a real vocal reaction.
    window.sumSquares += energySquare;
    window.peak = Math.max(window.peak, absolutePeak);
    if (
      window.previousValue !== null &&
      ((window.previousValue < 0 && value >= 0) ||
        (window.previousValue >= 0 && value < 0))
    ) {
      window.zeroCrossingCount += 1;
    }
    window.previousValue = value;

    const highPassAlpha =
      effectiveSampleRateHz /
      (effectiveSampleRateHz + 2 * Math.PI * SPEECH_BAND_LOW_HZ);
    const lowPassAlpha = 1 - Math.exp(
      (-2 * Math.PI * Math.min(SPEECH_BAND_HIGH_HZ, effectiveSampleRateHz * 0.45)) /
        effectiveSampleRateHz,
    );
    const highPassed =
      highPassAlpha *
      (this.previousHighPass + value - this.previousFilterInput);
    const bandPassed =
      this.previousLowPass + lowPassAlpha * (highPassed - this.previousLowPass);
    this.previousFilterInput = value;
    this.previousHighPass = highPassed;
    this.previousLowPass = bandPassed;

    window.speechBandEnergy += bandPassed * bandPassed;
    window.totalFilterEnergy += energySquare;
  }

  private ensureScratchCapacity(
    channelFrameCount: number,
    sampledFrameCount: number,
  ): void {
    if (this.channelPlaneScratch.length < channelFrameCount) {
      this.channelPlaneScratch = new Float32Array(nextPowerOfTwo(channelFrameCount));
    }
    if (this.downmixedScratch.length < sampledFrameCount) {
      const capacity = nextPowerOfTwo(sampledFrameCount);
      this.downmixedScratch = new Float32Array(capacity);
      this.frameEnergyScratch = new Float32Array(capacity);
      this.framePeakScratch = new Float32Array(capacity);
    }
  }

  private ensureFilterRate(effectiveSampleRateHz: number): void {
    if (Math.abs(this.filterSampleRateHz - effectiveSampleRateHz) < 0.5) {
      return;
    }
    this.filterSampleRateHz = effectiveSampleRateHz;
    this.previousFilterInput = 0;
    this.previousHighPass = 0;
    this.previousLowPass = 0;
  }

  private getOrCreateWindow(windowIndex: number): MutableFeatureWindow {
    const existing = this.windows.get(windowIndex);
    if (existing !== undefined) {
      return existing;
    }
    const startMs = windowIndex * AUDIO_REACTION_FEATURE_WINDOW_MS;
    const created: MutableFeatureWindow = {
      startMs,
      endMs: Math.min(
        this.sourceDurationMs,
        startMs + AUDIO_REACTION_FEATURE_WINDOW_MS,
      ),
      sampleCount: 0,
      sumSquares: 0,
      peak: 0,
      zeroCrossingCount: 0,
      previousValue: null,
      speechBandEnergy: 0,
      totalFilterEnergy: 0,
    };
    this.windows.set(windowIndex, created);
    return created;
  }
}

let activeTask: ActiveAudioTask | null = null;
let eventSequence = 0;

function createEventId(taskId: string): string {
  eventSequence += 1;
  const randomId = self.crypto?.randomUUID?.();
  return `${taskId}-${eventSequence}-${randomId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function postResponse(
  identity: AudioReactionWorkerIdentity,
  response: AudioReactionWorkerResponsePayload,
): void {
  const message = {
    ...identity,
    eventId: createEventId(identity.taskId),
    ...response,
  } satisfies AudioReactionWorkerResponse;
  self.postMessage(message);
}

function postProgress(
  identity: AudioReactionWorkerIdentity,
  progress: LocalAudioReactionAnalysisProgress,
): void {
  postResponse(identity, { type: "audio-reaction-progress", progress });
}

function disposeInputOnce(task: ActiveAudioTask): void {
  if (task.input === null || task.inputWasDisposed) {
    return;
  }
  task.inputWasDisposed = true;
  task.input.dispose();
}

function sameIdentity(
  left: AudioReactionWorkerIdentity,
  right: AudioReactionWorkerIdentity,
): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.writerEpoch === right.writerEpoch &&
    left.runId === right.runId &&
    left.workerEpoch === right.workerEpoch &&
    left.workerInstanceId === right.workerInstanceId &&
    left.taskId === right.taskId
  );
}

function unavailableResult(
  reasonCode: LocalAudioReactionUnavailableReason,
  sourceDurationMs: number,
): LocalAudioReactionUnavailableResult {
  return {
    mode: "local-audio-reaction-unavailable",
    sourceDurationMs,
    featureWindowMs: AUDIO_REACTION_FEATURE_WINDOW_MS,
    plannedWindowCount: Math.ceil(
      sourceDurationMs / AUDIO_REACTION_FEATURE_WINDOW_MS,
    ),
    analyzedWindowCount: 0,
    coverageComplete: false,
    candidates: [],
    reasonCode,
  };
}

async function decodeAndScore(
  request: Extract<AudioReactionWorkerRequest, { readonly type: "analyze-audio-reactions" }>,
  task: ActiveAudioTask,
): Promise<LocalAudioReactionAnalysisOutcome | null> {
  const sourceDurationMs = Math.round(request.sourceDurationMs);
  postProgress(task.identity, {
    stage: "opening-source",
    decodedThroughMs: 0,
    sourceDurationMs,
    analyzedWindowCount: 0,
    ratio: 0,
  });

  try {
    if (task.cancelled) {
      return null;
    }
    task.input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(request.file, { maxCacheSize: SOURCE_CACHE_BYTES }),
    });
    if (task.cancelled) {
      disposeInputOnce(task);
      return null;
    }

    const audioTrack = await task.input.getPrimaryAudioTrack();
    if (task.cancelled) {
      return null;
    }
    if (audioTrack === null) {
      return unavailableResult("NO_AUDIO_TRACK", sourceDurationMs);
    }
    if (!(await audioTrack.canDecode())) {
      if (task.cancelled) {
        return null;
      }
      return unavailableResult("UNSUPPORTED_AUDIO_CODEC", sourceDurationMs);
    }

    const accumulator = new AudioFeatureAccumulator(sourceDurationMs);
    const sink = new AudioSampleSink(audioTrack);
    let decodedThroughMs = 0;
    let lastProgressAt = 0;
    let lastProgressRatio = 0;

    for await (const sample of sink.samples()) {
      try {
        if (task.cancelled) {
          return null;
        }
        accumulator.consume(sample);
        decodedThroughMs = Math.max(
          decodedThroughMs,
          Math.round((sample.timestamp + sample.duration) * 1_000),
        );
      } finally {
        sample.close();
      }

      const durationRatio = clamp(decodedThroughMs / sourceDurationMs, 0, 1);
      const progressRatio = round(0.02 + durationRatio * 0.93, 6);
      const now = Date.now();
      if (
        lastProgressAt === 0 ||
        (now - lastProgressAt >= PROGRESS_MIN_REAL_INTERVAL_MS &&
          progressRatio - lastProgressRatio >= PROGRESS_MIN_RATIO_STEP)
      ) {
        lastProgressAt = now;
        lastProgressRatio = progressRatio;
        postProgress(task.identity, {
          stage: "decoding-audio",
          decodedThroughMs: clampInteger(decodedThroughMs, 0, sourceDurationMs),
          sourceDurationMs,
          analyzedWindowCount: accumulator.analyzedWindowCount(decodedThroughMs),
          ratio: progressRatio,
        });
      }
    }

    if (task.cancelled) {
      return null;
    }
    const windows = accumulator.finish();
    postProgress(task.identity, {
      stage: "scoring",
      decodedThroughMs: sourceDurationMs,
      sourceDurationMs,
      analyzedWindowCount: windows.length,
      ratio: 0.97,
    });

    try {
      return selectAudioReactionHighlights(
        windows,
        sourceDurationMs,
        {
          ...request.options,
          plannedWindowCount: Math.ceil(
            sourceDurationMs / AUDIO_REACTION_FEATURE_WINDOW_MS,
          ),
        },
      );
    } catch (cause) {
      throw new SignalEngineFailure(cause);
    }
  } catch (cause) {
    if (task.cancelled || cause instanceof InputDisposedError) {
      return null;
    }
    if (cause instanceof UnsupportedInputFormatError) {
      return unavailableResult("UNSUPPORTED_CONTAINER", sourceDurationMs);
    }
    if (isUnsupportedAudioCodecError(cause)) {
      return unavailableResult("UNSUPPORTED_AUDIO_CODEC", sourceDurationMs);
    }
    throw cause;
  } finally {
    disposeInputOnce(task);
  }
}

async function runTask(
  request: Extract<AudioReactionWorkerRequest, { readonly type: "analyze-audio-reactions" }>,
  task: ActiveAudioTask,
): Promise<void> {
  try {
    const result = await decodeAndScore(request, task);
    if (task.cancelled || result === null) {
      return;
    }

    if (result.mode === "local-audio-reaction-unavailable") {
      postProgress(task.identity, {
        stage: "unavailable",
        decodedThroughMs: 0,
        sourceDurationMs: result.sourceDurationMs,
        analyzedWindowCount: 0,
        ratio: 1,
      });
      postResponse(task.identity, {
        type: "audio-reaction-unavailable",
        result,
      });
      return;
    }

    postProgress(task.identity, {
      stage: "complete",
      decodedThroughMs: result.sourceDurationMs,
      sourceDurationMs: result.sourceDurationMs,
      analyzedWindowCount: result.analyzedWindowCount,
      ratio: 1,
    });
    postResponse(task.identity, {
      type: "audio-reaction-completed",
      result,
    });
  } catch (cause) {
    if (task.cancelled) {
      return;
    }
    postResponse(task.identity, {
      type: "audio-reaction-failed",
      reasonCode:
        cause instanceof SignalEngineFailure
          ? "SIGNAL_ENGINE_FAILED"
          : "AUDIO_DECODE_FAILED",
      message:
        cause instanceof Error && cause.message.length > 0
          ? cause.message
          : "오디오 반응 신호를 분석하지 못했어요.",
    });
  } finally {
    disposeInputOnce(task);
    if (activeTask === task) {
      activeTask = null;
    }
  }
}

function handleCancel(
  request: Extract<AudioReactionWorkerRequest, { readonly type: "cancel-audio-reactions" }>,
): void {
  const task = activeTask;
  if (task !== null && sameIdentity(task.identity, request.identity)) {
    task.cancelled = true;
    disposeInputOnce(task);
  }
  postResponse(request.identity, {
    type: "audio-reaction-cancel-acknowledged",
  });
}

function isUnsupportedAudioCodecError(cause: unknown): boolean {
  if (
    typeof DOMException !== "undefined" &&
    cause instanceof DOMException &&
    cause.name === "NotSupportedError"
  ) {
    return true;
  }
  if (!(cause instanceof Error)) {
    return false;
  }
  const message = cause.message.toLowerCase();
  return (
    message.includes("cannot be decoded") ||
    message.includes("codec is not supported") ||
    message.includes("unsupported audio codec") ||
    message.includes("audiodecoder") && message.includes("support")
  );
}

function nextPowerOfTwo(value: number): number {
  let capacity = 1;
  const target = Math.max(1, Math.ceil(value));
  while (capacity < target) {
    capacity *= 2;
  }
  return capacity;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

self.addEventListener("message", (event: MessageEvent<AudioReactionWorkerRequest>) => {
  const request = event.data;
  if (request.type === "cancel-audio-reactions") {
    handleCancel(request);
    return;
  }
  if (request.type !== "analyze-audio-reactions") {
    return;
  }

  if (activeTask !== null) {
    postResponse(request.identity, {
      type: "audio-reaction-failed",
      reasonCode: "AUDIO_DECODE_FAILED",
      message: "오디오 분석 작업 공간에서 이미 다른 작업을 처리하고 있어요.",
    });
    return;
  }

  const task: ActiveAudioTask = {
    identity: request.identity,
    cancelled: false,
    input: null,
    inputWasDisposed: false,
  };
  activeTask = task;
  void runTask(request, task);
});

export {};
