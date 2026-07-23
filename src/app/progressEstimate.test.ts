import { describe, expect, it } from "vitest";

import {
  estimateAnalysisDurationRangeMs,
  estimateRemainingMs,
  formatRemainingLabel,
} from "./progressEstimate";

describe("estimateAnalysisDurationRangeMs", () => {
  it("matches the product plan's 6-hour reference point of about 25-40 minutes", () => {
    const range = estimateAnalysisDurationRangeMs(6 * 3_600_000);
    expect(range.lowMs / 60_000).toBeCloseTo(25, 0);
    expect(range.highMs / 60_000).toBeCloseTo(40, 0);
  });

  it("scales down for a short broadcast but keeps a sane floor", () => {
    const range = estimateAnalysisDurationRangeMs(20 * 60_000);
    expect(range.lowMs).toBeGreaterThanOrEqual(3 * 60_000);
    expect(range.highMs).toBeGreaterThan(range.lowMs);
  });

  it("never produces a negative or inverted range for zero duration", () => {
    const range = estimateAnalysisDurationRangeMs(0);
    expect(range.lowMs).toBeGreaterThan(0);
    expect(range.highMs).toBeGreaterThan(range.lowMs);
  });
});

describe("estimateRemainingMs", () => {
  it("falls back to the static range before enough progress has accumulated", () => {
    const estimate = estimateRemainingMs({
      sourceDurationMs: 6 * 3_600_000,
      elapsedMs: 2_000,
      ratio: 0.01,
    });
    expect(estimate.basis).toBe("static");
  });

  it("falls back to the static range when no ratio exists yet", () => {
    const estimate = estimateRemainingMs({
      sourceDurationMs: 3_600_000,
      elapsedMs: 30_000,
      ratio: null,
    });
    expect(estimate.basis).toBe("static");
  });

  it("switches to a measured projection once elapsed time and ratio are both meaningful", () => {
    const estimate = estimateRemainingMs({
      sourceDurationMs: 6 * 3_600_000,
      elapsedMs: 60_000,
      ratio: 0.2,
    });
    expect(estimate.basis).toBe("measured");
    // elapsed=60s at ratio=0.2 implies a 300s total, so ~240s remain.
    expect(estimate.remainingMs).toBeCloseTo(240_000, -3);
  });

  it("never returns a negative remainder for a ratio near completion", () => {
    const estimate = estimateRemainingMs({
      sourceDurationMs: 3_600_000,
      elapsedMs: 500_000,
      ratio: 0.999,
    });
    expect(estimate.remainingMs).toBeGreaterThanOrEqual(0);
  });
});

describe("formatRemainingLabel", () => {
  it("marks a measured projection without an estimate caveat", () => {
    const label = formatRemainingLabel({ basis: "measured", remainingMs: 5 * 60_000 });
    expect(label).toBe("약 5분 남음");
  });

  it("marks a static fallback as an estimate", () => {
    const label = formatRemainingLabel({ basis: "static", remainingMs: 30 * 60_000 });
    expect(label).toContain("추정");
  });

  it("never claims zero minutes remain while work is still outstanding", () => {
    const label = formatRemainingLabel({ basis: "measured", remainingMs: 200 });
    expect(label).toBe("약 1분 남음");
  });
});
