import { describe, expect, it } from "vitest";

import {
  createSemanticLeadCandidate,
  parseSemanticLeadCandidates,
  serializeSemanticLeadCandidates,
} from "./semanticLeadCandidate";

describe("createSemanticLeadCandidate", () => {
  it("creates a source-fenced semantic candidate without pretending it was loud", () => {
    const candidate = createSemanticLeadCandidate(
      {
        leadId: "exact-apology",
        startChapterId: "chapter-1",
        endChapterId: "chapter-1",
        startMs: 0,
        endMs: 210_000,
        category: "apology-accountability",
        confidence: 0.91,
        eventSummaryKo: "실수를 인정하고 사과한다.",
        whyThisMomentKo: "방송의 핵심 책임 인정 장면이다.",
        evidenceCueKo: "제가 실수했습니다. 죄송합니다.",
        uncertaintiesKo: [],
      },
      {
        leadId: "exact-apology",
        startMs: 45_000,
        peakMs: 67_500,
        endMs: 90_000,
        transcriptMatchScore: 1,
        matchedSegmentId: "refine-001",
      },
      "제가 실수했습니다. 죄송합니다.",
    );

    expect(candidate.signalKinds).toEqual(["semantic"]);
    expect(candidate.evidence.audio).toBeUndefined();
    expect(candidate.evidence.semantic?.category).toBe("apology-accountability");
    expect(candidate.endMs - candidate.startMs).toBe(45_000);
    const serialized = serializeSemanticLeadCandidates([candidate]);
    expect(parseSemanticLeadCandidates(JSON.parse(serialized))).toEqual([candidate]);
  });
});
