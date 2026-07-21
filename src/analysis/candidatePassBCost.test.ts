import { describe, expect, it } from "vitest";

import {
  estimateCandidatePassBCost,
  formatEstimatedUsd,
} from "./candidatePassBCost";

describe("candidate Pass B cost estimate", () => {
  it("estimates the default twelve 45-second candidates below the large-input tier", () => {
    const estimate = estimateCandidatePassBCost(12, 45_000);

    expect(estimate.inputTokens).toBe(81_840);
    expect(estimate.outputTokens).toBe(8_400);
    expect(estimate.totalCostUsd).toBeCloseTo(0.19836, 6);
  });

  it("clamps planning input to the product's sixty-second candidate boundary", () => {
    const estimate = estimateCandidatePassBCost(12, 400_000);

    expect(estimate.audioDurationMs).toBe(60_000);
    expect(estimate.inputPricePerMillionUsd).toBe(1.5);
    expect(estimate.outputPricePerMillionUsd).toBe(9);
  });

  it("formats tiny estimates without pretending to know a precise cent value", () => {
    expect(formatEstimatedUsd(0)).toBe("$0.00");
    expect(formatEstimatedUsd(0.004)).toBe("<$0.01");
    expect(formatEstimatedUsd(0.253)).toBe("$0.25");
  });
});
