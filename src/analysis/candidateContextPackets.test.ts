import { describe, expect, it } from "vitest";
import { buildCandidatePassBContextPackets } from "./candidateContextPackets";
import type { BroadcastContextResult } from "./broadcastContextProtocol";
import type { UnifiedHighlightCandidate } from "./highlightFusion";

const semanticCandidate: UnifiedHighlightCandidate = {
  id: "semantic-apology",
  startMs: 120_000,
  peakMs: 145_000,
  endMs: 170_000,
  score: 0.92,
  reason: "전체 맥락 후보",
  signalKinds: ["semantic"],
  evidence: {
    normalization: "within-signal-rank-and-mad",
    semantic: {
      rankPercentile: 0.92,
      robustPercentile: 0.92,
      normalizedScore: 0.92,
      category: "apology-accountability",
      confidence: 0.92,
      eventSummaryKo: "실수로 구독을 연 사실을 바로잡는 장면",
      whyThisMomentKo: "사과의 원인과 책임 인정이 한 구간에서 완결된다.",
      evidenceCueKo: "제가 잘못 열었습니다. 죄송합니다.",
      transcriptKo: "제가 잘못 열었습니다. 혼란을 드려 죄송합니다.",
    },
  },
};

const broadcastContext: BroadcastContextResult = {
  schemaVersion: "1.6.0",
  broadcastSummaryKo:
    "방송 초반 잡담 뒤 설정 실수를 발견하고 정확히 사과한 다음 본편으로 돌아갔다.",
  hostStreamerProfile: null,
  recurringThemesKo: ["설정 확인과 사과"],
  annotations: [],
  semanticChaptersSupported: true,
  semanticChapters: [{
    semanticChapterId: "chapter-apology",
    startChapterId: "middle",
    endChapterId: "middle",
    startMs: 100_000,
    endMs: 190_000,
    titleKo: "구독 설정 실수 해명",
    summaryKo: "설정 실수를 확인하고 시청자에게 경위를 설명해 사과한다.",
    kind: "main-event",
    salience: "primary",
    relatedCandidateIds: ["semantic-apology"],
    uncertaintiesKo: [],
  }],
  discoveredLeadsSupported: true,
  discoveredLeads: [],
  coverage: {
    status: "complete",
    coveredMs: 300_000,
    coverageRatio: 1,
    gaps: [],
    partialChapterIds: [],
  },
};

describe("candidate context packets", () => {
  it("binds a semantic candidate to whole-flow, before, after and reference dialogue", () => {
    const packets = buildCandidatePassBContextPackets({
      candidates: [semanticCandidate],
      sourceDurationMs: 300_000,
      broadcastContext,
      transcriptChapters: [
        {
          chapterId: "before",
          startMs: 60_000,
          endMs: 120_000,
          evidenceMode: "complete-transcript",
          evidenceCoverageRatio: 1,
          summaryKo: "시청자와 방송 설정에 관해 잡담했다.",
        },
        {
          chapterId: "after",
          startMs: 170_000,
          endMs: 230_000,
          evidenceMode: "complete-transcript",
          evidenceCoverageRatio: 1,
          summaryKo: "사과를 마치고 원래 진행으로 돌아갔다.",
        },
      ],
      youtubeCaptionTrack: null,
    });

    expect(packets["semantic-apology"]).toMatchObject({
      transcriptSource: "semantic-refinement",
      transcriptKo: "제가 잘못 열었습니다. 혼란을 드려 죄송합니다.",
      contextCategory: "apology-accountability",
      contextDecision: "select",
    });
    expect(packets["semantic-apology"]?.beforeContextKo).toContain("잡담");
    expect(packets["semantic-apology"]?.afterContextKo).toContain("원래 진행");
    expect(packets["semantic-apology"]?.broadcastSummaryKo).toContain("정확히 사과");
  });
});
