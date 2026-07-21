import { describe, expect, it } from "vitest";
import type { BroadcastContextDiscoveredLead } from "./broadcastContextProtocol";
import {
  DISCOVERED_LEAD_REFINEMENT_BUDGET_USD,
  createDiscoveredLeadRefinementPlan,
  refineDiscoveredLeadRange,
} from "./discoveredLeadRefinement";

function lead(id: string, startMs: number, confidence = 0.9): BroadcastContextDiscoveredLead {
  return {
    leadId: id,
    startChapterId: `chapter-${id}`,
    endChapterId: `chapter-${id}`,
    startMs,
    endMs: startMs + 210_000,
    category: "apology-accountability",
    confidence,
    eventSummaryKo: "실수를 인정하고 사과한다.",
    whyThisMomentKo: "정확한 사과 장면이다.",
    evidenceCueKo: "실수로 구독을 열어서 죄송합니다",
    uncertaintiesKo: [],
  };
}

describe("discoveredLeadRefinement", () => {
  it("bounds four semantic leads under the three-cent ASR reserve", () => {
    const plan = createDiscoveredLeadRefinementPlan(
      Array.from({ length: 8 }, (_, index) => lead(String(index + 1), index * 300_000)),
    );
    expect(plan.selectedLeadIds).toHaveLength(4);
    expect(plan.estimatedAsrCostUsd).toBeLessThanOrEqual(
      DISCOVERED_LEAD_REFINEMENT_BUDGET_USD,
    );
    expect(
      plan.segments.every(
        (segment) => segment.sourceEndMs - segment.sourceStartMs <= 70_000,
      ),
    ).toBe(true);
  });

  it("locates the exact apology cell instead of choosing the loudest neighbor", () => {
    const target = lead("apology", 600_000);
    const plan = createDiscoveredLeadRefinementPlan([target]);
    const transcripts = plan.segments.map((segment, index) => ({
      schemaVersion: "1.0.0" as const,
      modelId: "qwen3-asr-flash" as const,
      sourceStartMs: segment.sourceStartMs,
      sourceEndMs: segment.sourceEndMs,
      textKo:
        index === 1
          ? "제가 실수로 구독을 열어서 정말 죄송합니다."
          : "게임 화면을 보며 평범한 이야기를 이어간다.",
      detectedLanguage: "ko",
      emotion: index === 1 ? "sad" : "neutral",
      billedSeconds: 70,
    }));
    const refined = refineDiscoveredLeadRange(target, plan, transcripts, 2_000_000);
    expect(refined?.matchedSegmentId).toBe(plan.segments[1]?.segmentId);
    expect(refined?.transcriptMatchScore).toBeGreaterThan(0.5);
    expect((refined?.endMs ?? 0) - (refined?.startMs ?? 0)).toBe(45_000);
  });
});
