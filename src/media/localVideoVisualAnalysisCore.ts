export const VISUAL_FINGERPRINT_WIDTH = 32 as const;
export const VISUAL_FINGERPRINT_HEIGHT = 18 as const;
export const VISUAL_FINGERPRINT_SIZE =
  VISUAL_FINGERPRINT_WIDTH * VISUAL_FINGERPRINT_HEIGHT;
export const MAX_VISUAL_SAMPLE_COUNT = 720 as const;
export const VISUAL_SAMPLE_TARGET_INTERVAL_MS = 5_000 as const;
export const VISUAL_CANDIDATE_WINDOW_MS = 45_000 as const;
export const MAX_VISUAL_CANDIDATE_COUNT = 12 as const;

const PIXEL_CHANGE_LUMA_THRESHOLD = 28;
const MIN_SCENE_CHANGE_STRENGTH = 0.08;
const MIN_MEAN_LUMA_DIFFERENCE = 0.04;
const MIN_CHANGED_PIXEL_RATIO = 0.08;
const MIN_ROBUST_SCENE_SCORE = 3;
const MIN_ROBUST_SCALE = 0.01;

export interface VisualFrameSample {
  readonly timestampMs: number;
  readonly fingerprint: ArrayLike<number>;
}

export interface LocalVideoVisualEvidence {
  readonly previousFrameMs: number;
  readonly currentFrameMs: number;
  readonly meanLumaDifference: number;
  readonly changedPixelRatio: number;
  readonly sceneChangeStrength: number;
  readonly baselineSceneChangeStrength: number;
  readonly medianAbsoluteDeviation: number;
  readonly robustSceneScore: number;
}

export interface LocalVideoVisualCandidate {
  readonly id: string;
  readonly peakMs: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly score: number;
  readonly reason: string;
  readonly evidence: LocalVideoVisualEvidence;
}

export interface LocalVideoVisualAnalysisDiagnostics {
  readonly fingerprintWidth: typeof VISUAL_FINGERPRINT_WIDTH;
  readonly fingerprintHeight: typeof VISUAL_FINGERPRINT_HEIGHT;
  readonly targetSampleIntervalMs: typeof VISUAL_SAMPLE_TARGET_INTERVAL_MS;
  readonly actualMedianSampleIntervalMs: number;
  readonly baselineSceneChangeStrength: number;
  readonly medianAbsoluteDeviation: number;
  readonly eligibleTransitionCount: number;
}

export interface LocalVideoVisualAnalysisResult {
  readonly mode: "local-video-visual-fast-pass";
  readonly sourceDurationMs: number;
  readonly plannedSampleCount: number;
  readonly sampledFrameCount: number;
  readonly coverageComplete: boolean;
  readonly analyzedTransitionCount: number;
  readonly candidateWindowMs: typeof VISUAL_CANDIDATE_WINDOW_MS;
  readonly candidates: readonly LocalVideoVisualCandidate[];
  readonly diagnostics: LocalVideoVisualAnalysisDiagnostics;
}

export interface SelectVisualHighlightsOptions {
  readonly maxCandidates?: number;
  readonly plannedSampleCount?: number;
}

interface TransitionSignal {
  readonly previousFrameMs: number;
  readonly currentFrameMs: number;
  readonly meanLumaDifference: number;
  readonly changedPixelRatio: number;
  readonly sceneChangeStrength: number;
}

interface ScoredTransition extends TransitionSignal {
  readonly baselineSceneChangeStrength: number;
  readonly medianAbsoluteDeviation: number;
  readonly robustSceneScore: number;
  readonly eligible: boolean;
}

/**
 * Builds a deterministic, duration-aware sampling plan. It avoids the exact
 * media edges because several browsers cannot decode a frame at duration or
 * reliably emit `seeked` for an unchanged currentTime of zero.
 */
export function buildVisualSampleTimestamps(
  sourceDurationMs: number,
  requestedMaximum: number = MAX_VISUAL_SAMPLE_COUNT,
): readonly number[] {
  const durationMs = normalizePositiveDuration(sourceDurationMs);
  const maximum = clampInteger(
    requestedMaximum,
    1,
    MAX_VISUAL_SAMPLE_COUNT,
    MAX_VISUAL_SAMPLE_COUNT,
  );
  const lastMediaMillisecond = Math.max(0, durationMs - 1);
  const edgePaddingMs = Math.min(250, Math.floor(durationMs / 4));
  const firstTimestampMs = Math.min(lastMediaMillisecond, edgePaddingMs);
  const lastTimestampMs = Math.max(
    firstTimestampMs,
    lastMediaMillisecond - edgePaddingMs,
  );
  const spanMs = lastTimestampMs - firstTimestampMs;

  if (maximum === 1 || spanMs === 0) {
    return [firstTimestampMs];
  }

  const desiredCount = Math.ceil(spanMs / VISUAL_SAMPLE_TARGET_INTERVAL_MS) + 1;
  const sampleCount = Math.min(maximum, Math.max(2, desiredCount));
  const timestamps: number[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const timestampMs = Math.round(
      firstTimestampMs + (spanMs * index) / (sampleCount - 1),
    );
    if (timestamps.at(-1) !== timestampMs) {
      timestamps.push(timestampMs);
    }
  }

  return timestamps;
}

/**
 * Pure scoring core. Fingerprints are consumed only while this function runs;
 * the serializable result deliberately contains no frame pixels or media data.
 */
export function selectVisualHighlightsFromSamples(
  samples: readonly VisualFrameSample[],
  sourceDurationMs: number,
  options: SelectVisualHighlightsOptions = {},
): LocalVideoVisualAnalysisResult {
  const durationMs = normalizePositiveDuration(sourceDurationMs);
  const normalizedSamples = normalizeSamples(samples, durationMs);
  const plannedSampleCount = clampInteger(
    options.plannedSampleCount ?? normalizedSamples.length,
    0,
    MAX_VISUAL_SAMPLE_COUNT,
    normalizedSamples.length,
  );
  const transitions = createTransitionSignals(normalizedSamples);
  const strengths = transitions.map((transition) => transition.sceneChangeStrength);
  const baseline = median(strengths);
  const deviations = strengths.map((strength) => Math.abs(strength - baseline));
  const mad = median(deviations);
  const robustScale = Math.max(MIN_ROBUST_SCALE, 1.4826 * mad);
  const hasEnoughTransitionsForRobustBaseline = transitions.length >= 4;
  const requiredStrength = hasEnoughTransitionsForRobustBaseline
    ? Math.max(
        MIN_SCENE_CHANGE_STRENGTH,
        baseline + Math.max(3 * robustScale, 0.04),
      )
    : MIN_SCENE_CHANGE_STRENGTH;
  const scored = transitions.map((transition) => {
    const robustSceneScore = (transition.sceneChangeStrength - baseline) / robustScale;
    const eligible =
      transition.sceneChangeStrength > requiredStrength &&
      transition.meanLumaDifference >= MIN_MEAN_LUMA_DIFFERENCE &&
      transition.changedPixelRatio >= MIN_CHANGED_PIXEL_RATIO &&
      (!hasEnoughTransitionsForRobustBaseline || robustSceneScore >= MIN_ROBUST_SCENE_SCORE);

    return {
      ...transition,
      baselineSceneChangeStrength: baseline,
      medianAbsoluteDeviation: mad,
      robustSceneScore,
      eligible,
    } satisfies ScoredTransition;
  });
  const localPeaks = scored.filter((transition, index) => {
    if (!transition.eligible) {
      return false;
    }
    const previousStrength = scored[index - 1]?.sceneChangeStrength ?? -1;
    const nextStrength = scored[index + 1]?.sceneChangeStrength ?? -1;
    return (
      transition.sceneChangeStrength > previousStrength &&
      transition.sceneChangeStrength >= nextStrength
    );
  });
  localPeaks.sort(compareTransitions);

  const maxCandidates = clampInteger(
    options.maxCandidates ?? MAX_VISUAL_CANDIDATE_COUNT,
    0,
    MAX_VISUAL_CANDIDATE_COUNT,
    MAX_VISUAL_CANDIDATE_COUNT,
  );
  const candidates: LocalVideoVisualCandidate[] = [];

  for (const transition of localPeaks) {
    if (candidates.length >= maxCandidates) {
      break;
    }
    const candidate = createCandidate(transition, durationMs);
    if (candidates.some((accepted) => rangesOverlap(accepted, candidate))) {
      continue;
    }
    candidates.push(candidate);
  }

  return {
    mode: "local-video-visual-fast-pass",
    sourceDurationMs: durationMs,
    plannedSampleCount,
    sampledFrameCount: normalizedSamples.length,
    coverageComplete:
      plannedSampleCount > 0 && normalizedSamples.length === plannedSampleCount,
    analyzedTransitionCount: transitions.length,
    candidateWindowMs: VISUAL_CANDIDATE_WINDOW_MS,
    candidates,
    diagnostics: {
      fingerprintWidth: VISUAL_FINGERPRINT_WIDTH,
      fingerprintHeight: VISUAL_FINGERPRINT_HEIGHT,
      targetSampleIntervalMs: VISUAL_SAMPLE_TARGET_INTERVAL_MS,
      actualMedianSampleIntervalMs: medianSampleInterval(normalizedSamples),
      baselineSceneChangeStrength: round(baseline, 6),
      medianAbsoluteDeviation: round(mad, 6),
      eligibleTransitionCount: scored.filter((transition) => transition.eligible).length,
    },
  };
}

function normalizeSamples(
  samples: readonly VisualFrameSample[],
  durationMs: number,
): readonly VisualFrameSample[] {
  const normalized = samples.map((sample, index) => {
    if (!Number.isFinite(sample.timestampMs)) {
      throw new RangeError(`samples[${index}].timestampMs must be finite.`);
    }
    const timestampMs = Math.round(sample.timestampMs);
    if (timestampMs < 0 || timestampMs >= durationMs) {
      throw new RangeError(
        `samples[${index}].timestampMs must be within the source duration.`,
      );
    }
    if (sample.fingerprint.length !== VISUAL_FINGERPRINT_SIZE) {
      throw new RangeError(
        `samples[${index}].fingerprint must contain ${VISUAL_FINGERPRINT_SIZE} values.`,
      );
    }
    for (let pixelIndex = 0; pixelIndex < sample.fingerprint.length; pixelIndex += 1) {
      const value = sample.fingerprint[pixelIndex];
      if (value === undefined || !Number.isFinite(value) || value < 0 || value > 255) {
        throw new RangeError(
          `samples[${index}].fingerprint[${pixelIndex}] must be between 0 and 255.`,
        );
      }
    }
    return { timestampMs, fingerprint: sample.fingerprint };
  });

  normalized.sort((left, right) => left.timestampMs - right.timestampMs);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1]?.timestampMs === normalized[index]?.timestampMs) {
      throw new RangeError("Visual frame sample timestamps must be unique.");
    }
  }
  return normalized;
}

function createTransitionSignals(
  samples: readonly VisualFrameSample[],
): readonly TransitionSignal[] {
  const transitions: TransitionSignal[] = [];

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (previous === undefined || current === undefined) {
      continue;
    }

    let absoluteDifferenceSum = 0;
    let changedPixelCount = 0;
    for (let pixelIndex = 0; pixelIndex < VISUAL_FINGERPRINT_SIZE; pixelIndex += 1) {
      const previousLuma = previous.fingerprint[pixelIndex] ?? 0;
      const currentLuma = current.fingerprint[pixelIndex] ?? 0;
      const difference = Math.abs(currentLuma - previousLuma);
      absoluteDifferenceSum += difference;
      if (difference >= PIXEL_CHANGE_LUMA_THRESHOLD) {
        changedPixelCount += 1;
      }
    }

    const meanLumaDifference =
      absoluteDifferenceSum / (VISUAL_FINGERPRINT_SIZE * 255);
    const changedPixelRatio = changedPixelCount / VISUAL_FINGERPRINT_SIZE;
    const sceneChangeStrength = meanLumaDifference * 0.65 + changedPixelRatio * 0.35;
    transitions.push({
      previousFrameMs: previous.timestampMs,
      currentFrameMs: current.timestampMs,
      meanLumaDifference,
      changedPixelRatio,
      sceneChangeStrength,
    });
  }

  return transitions;
}

function createCandidate(
  transition: ScoredTransition,
  durationMs: number,
): LocalVideoVisualCandidate {
  const peakMs = Math.round((transition.previousFrameMs + transition.currentFrameMs) / 2);
  const effectiveWindowMs = Math.min(VISUAL_CANDIDATE_WINDOW_MS, durationMs);
  const beforePeakMs = Math.round((effectiveWindowMs * 4) / 9);
  const latestStartMs = Math.max(0, durationMs - effectiveWindowMs);
  const startMs = clamp(peakMs - beforePeakMs, 0, latestStartMs);
  const endMs = startMs + effectiveWindowMs;
  const evidence: LocalVideoVisualEvidence = {
    previousFrameMs: transition.previousFrameMs,
    currentFrameMs: transition.currentFrameMs,
    meanLumaDifference: round(transition.meanLumaDifference, 6),
    changedPixelRatio: round(transition.changedPixelRatio, 6),
    sceneChangeStrength: round(transition.sceneChangeStrength, 6),
    baselineSceneChangeStrength: round(transition.baselineSceneChangeStrength, 6),
    medianAbsoluteDeviation: round(transition.medianAbsoluteDeviation, 6),
    robustSceneScore: round(transition.robustSceneScore, 3),
  };

  return {
    id: `visual-${transition.previousFrameMs}-${transition.currentFrameMs}-${startMs}-${endMs}`,
    peakMs,
    startMs,
    endMs,
    score: round(
      Math.min(20, Math.max(0, transition.robustSceneScore)) +
        transition.sceneChangeStrength,
      6,
    ),
    reason:
      "전후 화면의 밝기 패턴이 평소보다 크게 달라진 장면 전환 신호예요. 실제 내용을 확인해 하이라이트인지 결정해 주세요.",
    evidence,
  };
}

function medianSampleInterval(samples: readonly VisualFrameSample[]): number {
  const intervals: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (previous !== undefined && current !== undefined) {
      intervals.push(current.timestampMs - previous.timestampMs);
    }
  }
  return Math.round(median(intervals));
}

function compareTransitions(left: ScoredTransition, right: ScoredTransition): number {
  return (
    right.robustSceneScore - left.robustSceneScore ||
    right.sceneChangeStrength - left.sceneChangeStrength ||
    left.currentFrameMs - right.currentFrameMs
  );
}

function rangesOverlap(
  left: Pick<LocalVideoVisualCandidate, "startMs" | "endMs">,
  right: Pick<LocalVideoVisualCandidate, "startMs" | "endMs">,
): boolean {
  return Math.max(left.startMs, right.startMs) < Math.min(left.endMs, right.endMs);
}

function normalizePositiveDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("sourceDurationMs must be a finite positive number.");
  }
  return Math.max(1, Math.round(value));
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return clamp(Math.floor(value), minimum, maximum);
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) {
    return upper;
  }
  return ((sorted[middle - 1] ?? upper) + upper) / 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
