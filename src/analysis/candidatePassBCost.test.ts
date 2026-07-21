import { describe, expect, it } from "vitest";

import {
  estimateCandidatePassBCost,
  formatEstimatedUsd,
} from "./candidatePassBCost";

describe("candidate Pass B cost estimate", () => {
  it("estimates twelve Qwen Omni candidates with modality-specific prices", () => {
    const estimate = estimateCandidatePassBCost(12, 45_000);

    expect(estimate.audioInputTokens).toBe(3_780);
    expect(estimate.textImageInputTokens).toBe(45_360);
    expect(estimate.inputTokens).toBe(49_140);
    expect(estimate.outputTokens).toBe(8_400);
    expect(estimate.totalCostUsd).toBeCloseTo(0.047964, 6);
  });

  it("clamps planning input to the product's sixty-second candidate boundary", () => {
    const estimate = estimateCandidatePassBCost(12, 400_000);

    expect(estimate.audioDurationMs).toBe(60_000);
    expect(estimate.audioInputPricePerMillionUsd).toBe(3);
    expect(estimate.textImageInputPricePerMillionUsd).toBe(0.4);
    expect(estimate.outputPricePerMillionUsd).toBe(2.2);
  });

  it("formats tiny estimates without pretending to know a precise cent value", () => {
    expect(formatEstimatedUsd(0)).toBe("$0.00");
    expect(formatEstimatedUsd(0.004)).toBe("<$0.01");
    expect(formatEstimatedUsd(0.253)).toBe("$0.25");
  });
});
