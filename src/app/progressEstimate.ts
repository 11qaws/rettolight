/**
 * Honest time estimates for the fast-scan waiting screen.
 *
 * The progress bar used to show fabricated constants (0.76, 0.84, ...) for
 * stages whose real completion fraction wasn't known, which made the bar
 * appear to stall. This module produces a duration estimate instead: a
 * static range before there is enough signal to project from, and a
 * measured projection once the run has been going long enough that
 * elapsed-time / ratio is a meaningful extrapolation.
 *
 * Every output is deliberately a range or an "약" (about) prefix — never a
 * precise-looking number for a process whose real duration depends on the
 * user's hardware and the broadcast's content.
 */

export interface AnalysisDurationRangeMs {
  readonly lowMs: number;
  readonly highMs: number;
}

/**
 * Static planning estimate from source duration alone, before any progress
 * signal exists. Calibrated to "6시간 기준 약 25~40분" from the product
 * plan: roughly 4.2–6.7 minutes of processing per hour of broadcast.
 */
export function estimateAnalysisDurationRangeMs(
  sourceDurationMs: number,
): AnalysisDurationRangeMs {
  const hours = Math.max(0, sourceDurationMs) / 3_600_000;
  const lowMs = Math.max(3 * 60_000, Math.round(hours * 25 * 60_000) / 6);
  const highMs = Math.max(lowMs + 2 * 60_000, Math.round(hours * 40 * 60_000) / 6);
  return { lowMs, highMs };
}

/**
 * Minimum elapsed time and ratio before a measured projection replaces the
 * static estimate. Below this, elapsed/ratio swings wildly on noisy early
 * progress and would read as more precise than it is.
 */
const MINIMUM_ELAPSED_MS_FOR_PROJECTION = 8_000;
const MINIMUM_RATIO_FOR_PROJECTION = 0.04;

export interface RemainingEstimateInput {
  readonly sourceDurationMs: number;
  readonly elapsedMs: number;
  /** Fast-scan completion fraction in [0, 1], or null before any progress arrives. */
  readonly ratio: number | null;
}

export type RemainingEstimateBasis = "static" | "measured";

export interface RemainingEstimate {
  readonly basis: RemainingEstimateBasis;
  readonly remainingMs: number;
}

/**
 * Projects remaining time from elapsed time and completion ratio once both
 * are large enough to trust, falling back to the static duration-based range
 * (using its midpoint) otherwise.
 */
export function estimateRemainingMs(
  input: RemainingEstimateInput,
): RemainingEstimate {
  if (
    input.ratio !== null &&
    input.ratio >= MINIMUM_RATIO_FOR_PROJECTION &&
    input.elapsedMs >= MINIMUM_ELAPSED_MS_FOR_PROJECTION
  ) {
    const projectedTotalMs = input.elapsedMs / input.ratio;
    return {
      basis: "measured",
      remainingMs: Math.max(0, projectedTotalMs - input.elapsedMs),
    };
  }
  const range = estimateAnalysisDurationRangeMs(input.sourceDurationMs);
  const midpointMs = (range.lowMs + range.highMs) / 2;
  return {
    basis: "static",
    remainingMs: Math.max(0, midpointMs - input.elapsedMs),
  };
}

/** Rounds to the nearest whole minute, never showing zero for real remaining work. */
function roundToMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

/**
 * "약 N분 남음" for a measured projection, "약 N~M분" for the static range —
 * the two read differently on purpose, so the editor can tell whether the
 * number comes from real progress or a planning guess.
 */
export function formatRemainingLabel(estimate: RemainingEstimate): string {
  if (estimate.basis === "measured") {
    const minutes = roundToMinutes(estimate.remainingMs);
    return minutes <= 1 ? "약 1분 남음" : `약 ${minutes}분 남음`;
  }
  const minutes = roundToMinutes(estimate.remainingMs);
  return `약 ${minutes}분 남음 (추정)`;
}
