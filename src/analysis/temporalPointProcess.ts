export interface TemporalEventDensityBin {
  readonly startMs: number;
  readonly endMs: number;
  readonly eventCount: number;
  readonly expectedEventCount: number;
  readonly poissonTailProbability: number | null;
  readonly densityClass: "quiet" | "normal" | "burst";
}

export interface TemporalEventDensityDiagnostics {
  readonly binSizeMs: number;
  readonly totalEventCount: number;
  readonly meanEventCount: number;
  readonly varianceEventCount: number;
  readonly dispersionIndex: number | null;
}

export interface TemporalEventDensityResult {
  readonly bins: readonly TemporalEventDensityBin[];
  readonly diagnostics: TemporalEventDensityDiagnostics;
}

// Upper tail probability P(X >= k)
function poissonUpperTail(k: number, lambda: number): number {
  if (lambda === 0) return k === 0 ? 1 : 0;
  if (k <= 0) return 1;

  // Recurrence P(X=i+1)=P(X=i)*lambda/(i+1) avoids factorial overflow.
  // For very large lambda, the first term may underflow; the normal
  // approximation is sufficiently stable for the density diagnostic only.
  if (lambda > 700) {
    const z = (k - 0.5 - lambda) / Math.sqrt(lambda);
    const cdf = 0.5 * (1 + approximateErf(z / Math.SQRT2));
    return clampProbability(1 - cdf);
  }
  let probability = Math.exp(-lambda);
  let lowerTail = probability;
  for (let i = 1; i < k; i += 1) {
    probability *= lambda / i;
    lowerTail += probability;
  }
  return clampProbability(1 - lowerTail);
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Abramowitz-Stegun 7.1.26, adequate for a diagnostic fallback.
function approximateErf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial =
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) * t +
      0.254829592) *
    t;
  return sign * (1 - polynomial * Math.exp(-x * x));
}

export function calculateTemporalEventDensity(
  episodeCenterTimesMs: readonly number[],
  sourceDurationMs: number,
  binSizeMs = 300_000,
): TemporalEventDensityResult {
  const safeDurationMs = Math.max(0, sourceDurationMs);
  const binCount = Math.ceil(safeDurationMs / binSizeMs);
  
  if (binCount === 0) {
    return {
      bins: [],
      diagnostics: {
        binSizeMs,
        totalEventCount: 0,
        meanEventCount: 0,
        varianceEventCount: 0,
        dispersionIndex: null,
      },
    };
  }

  const rawCounts: number[] = new Array<number>(binCount).fill(0);
  let totalEventCount = 0;

  for (const timeMs of episodeCenterTimesMs) {
    if (timeMs >= 0 && timeMs < safeDurationMs) {
      const index = Math.floor(timeMs / binSizeMs);
      if (index >= 0 && index < binCount) {
        rawCounts[index]!++;
        totalEventCount++;
      }
    }
  }

  const globalMean = totalEventCount / binCount;

  // Calculate variance
  let sumSquaredDiff = 0;
  for (const count of rawCounts) {
    const diff = count - globalMean;
    sumSquaredDiff += diff * diff;
  }
  const varianceEventCount = sumSquaredDiff / binCount;
  const dispersionIndex = globalMean > 0 ? varianceEventCount / globalMean : null;

  const bins: TemporalEventDensityBin[] = [];
  const priorStrength = 2;

  for (let i = 0; i < binCount; i++) {
    const previous = i > 0 ? rawCounts[i - 1]! : rawCounts[i]!;
    const current = rawCounts[i]!;
    const next = i < binCount - 1 ? rawCounts[i + 1]! : rawCounts[i]!;

    const neighborObserved = 0.25 * previous + 0.5 * current + 0.25 * next;
    const expectedEventCount =
      (globalMean * priorStrength + neighborObserved) / (priorStrength + 1);

    // Poisson tail probability for burst detection
    // Only calculate if current > expected
    let poissonTailProbability: number | null = null;
    let densityClass: "quiet" | "normal" | "burst" = "normal";

    if (expectedEventCount > 0) {
      if (current > expectedEventCount) {
        poissonTailProbability = poissonUpperTail(current, expectedEventCount);
        if (poissonTailProbability < 0.05 || current / expectedEventCount >= 2.5) {
          densityClass = "burst";
        }
      } else if (current < expectedEventCount * 0.5) {
        densityClass = "quiet";
      }
    } else {
      if (current > 0) {
        densityClass = "burst";
      } else {
        densityClass = "quiet";
      }
    }

    bins.push({
      startMs: i * binSizeMs,
      endMs: Math.min((i + 1) * binSizeMs, safeDurationMs),
      eventCount: current,
      expectedEventCount,
      poissonTailProbability,
      densityClass,
    });
  }

  return {
    bins,
    diagnostics: {
      binSizeMs,
      totalEventCount,
      meanEventCount: globalMean,
      varianceEventCount,
      dispersionIndex,
    },
  };
}
