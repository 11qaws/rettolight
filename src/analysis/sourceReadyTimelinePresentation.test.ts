import { describe, expect, it } from "vitest";

import {
  SOURCE_READY_TIMELINE_TICK_MS,
  buildSourceReadyTimelineTicks,
} from "./sourceReadyTimelinePresentation";

describe("buildSourceReadyTimelineTicks", () => {
  it("keeps every 30-minute mark plus the exact source end", () => {
    const durationMs = 2 * 60 * 60 * 1_000 + 15 * 60 * 1_000;
    const ticks = buildSourceReadyTimelineTicks(durationMs);

    expect(ticks.map((tick) => tick.timestampMs)).toEqual([
      0,
      SOURCE_READY_TIMELINE_TICK_MS,
      SOURCE_READY_TIMELINE_TICK_MS * 2,
      SOURCE_READY_TIMELINE_TICK_MS * 3,
      SOURCE_READY_TIMELINE_TICK_MS * 4,
      durationMs,
    ]);
    expect(ticks.map((tick) => tick.showLabel)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(ticks.at(-1)).toMatchObject({
      positionPercent: 100,
      edge: "end",
    });
  });

  it("keeps 30-minute rules but labels every two hours at twelve hours", () => {
    const durationMs = 12 * 60 * 60 * 1_000;
    const ticks = buildSourceReadyTimelineTicks(durationMs);

    expect(ticks).toHaveLength(25);
    expect(
      ticks.filter((tick) => tick.showLabel).map((tick) => tick.timestampMs),
    ).toEqual([
      0,
      2 * 60 * 60 * 1_000,
      4 * 60 * 60 * 1_000,
      6 * 60 * 60 * 1_000,
      8 * 60 * 60 * 1_000,
      10 * 60 * 60 * 1_000,
      12 * 60 * 60 * 1_000,
    ]);
  });

  it("does not duplicate an end that lands on a 30-minute boundary", () => {
    const ticks = buildSourceReadyTimelineTicks(SOURCE_READY_TIMELINE_TICK_MS);

    expect(ticks.map((tick) => tick.timestampMs)).toEqual([
      0,
      SOURCE_READY_TIMELINE_TICK_MS,
    ]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns an empty projection for invalid duration %s",
    (durationMs) => {
      expect(buildSourceReadyTimelineTicks(durationMs)).toEqual([]);
    },
  );
});
