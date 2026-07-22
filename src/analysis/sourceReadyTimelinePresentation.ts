export const SOURCE_READY_TIMELINE_TICK_MS = 30 * 60 * 1_000;

export interface SourceReadyTimelineTick {
  readonly timestampMs: number;
  readonly positionPercent: number;
  readonly showLabel: boolean;
  readonly edge: "start" | "middle" | "end";
}

function labelStrideForDuration(durationMs: number): number {
  const halfHourSpanCount = Math.ceil(durationMs / SOURCE_READY_TIMELINE_TICK_MS);
  if (halfHourSpanCount <= 6) return 1;
  if (halfHourSpanCount <= 12) return 2;
  if (halfHourSpanCount <= 24) return 4;
  return 6;
}

/**
 * Builds a compact preview of the same source-time ruler used by the result
 * timeline. Every 30-minute boundary remains visible; labels thin out on long
 * broadcasts so a 12-hour source does not become unreadable before analysis.
 */
export function buildSourceReadyTimelineTicks(
  durationMs: number,
): readonly SourceReadyTimelineTick[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return [];

  const timestamps: number[] = [0];
  for (
    let timestampMs = SOURCE_READY_TIMELINE_TICK_MS;
    timestampMs < durationMs;
    timestampMs += SOURCE_READY_TIMELINE_TICK_MS
  ) {
    timestamps.push(timestampMs);
  }
  timestamps.push(durationMs);

  const labelStride = labelStrideForDuration(durationMs);
  return timestamps.map((timestampMs, index) => ({
    timestampMs,
    positionPercent: Number(((timestampMs / durationMs) * 100).toFixed(4)),
    showLabel:
      index === 0 ||
      index === timestamps.length - 1 ||
      index % labelStride === 0,
    edge:
      index === 0
        ? "start"
        : index === timestamps.length - 1
          ? "end"
          : "middle",
  }));
}
