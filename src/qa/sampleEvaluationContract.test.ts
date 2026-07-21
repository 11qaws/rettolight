import { describe, expect, it } from "vitest";
import { SAMPLE_EVALUATION_CONTRACTS } from "./sampleEvaluationContract";

describe("sampleEvaluationContract", () => {
  it("keeps all three food-talk positives and excludes opening music", () => {
    expect(
      SAMPLE_EVALUATION_CONTRACTS.foodTalk.knownPositiveMoments.map(
        (moment) => moment.labelKo,
      ),
    ).toEqual(["칼국수", "껍데기", "두바이초콜릿"]);
    expect(
      SAMPLE_EVALUATION_CONTRACTS.foodTalk.forbiddenAutomaticCategories,
    ).toContain("music-or-song");
  });

  it("treats the relay sample as a valid all-negative outcome", () => {
    expect(SAMPLE_EVALUATION_CONTRACTS.minecraftRelay.mode).toBe(
      "negative-abstention",
    );
    expect(
      SAMPLE_EVALUATION_CONTRACTS.minecraftRelay.knownPositiveMoments,
    ).toHaveLength(0);
  });

  it("does not invent the exact apology timestamp", () => {
    expect(SAMPLE_EVALUATION_CONTRACTS.accidentalSubscription.mode).toBe(
      "context-target",
    );
    expect(
      SAMPLE_EVALUATION_CONTRACTS.accidentalSubscription.knownPositiveMoments,
    ).toHaveLength(0);
  });
});
