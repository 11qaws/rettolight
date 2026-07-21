import { describe, expect, it } from "vitest";
import {
  buildBroadcastContextDeepseekRequestBody,
  buildBroadcastContextQwenRequestBody,
  extractBroadcastContextDeepseekResponse,
} from "./broadcastContextDeepseek";
import type { BroadcastContextRequest } from "./broadcastContextProtocol";

const dummyRequest: BroadcastContextRequest = {
  schemaVersion: "1.4.0",
  sourceDurationMs: 3600000,
  chapters: [
    {
      chapterId: "c1",
      startMs: 0,
      endMs: 300000,
      evidenceMode: "complete-transcript",
      evidenceCoverageRatio: 1,
      summaryKo: "첫 번째 챕터 요약",
    },
    {
      chapterId: "c2",
      startMs: 300000,
      endMs: 600000,
      evidenceMode: "sampled-audio-video",
      evidenceCoverageRatio: 0.5,
      summaryKo: "두 번째 챕터 요약",
    },
  ],
  candidates: [
    {
      candidateId: "can1",
      startMs: 60000,
      endMs: 90000,
      transcriptKo: "대화 내용",
      eventSummaryKo: "사건 내용",
      reactionSummaryKo: "리액션 내용",
      chatReactionSummaryKo: null,
    },
  ],
};

describe("broadcastContextDeepseek", () => {
  describe("buildBroadcastContextDeepseekRequestBody", () => {
    it("builds a correct prompt and request body", () => {
      const body = buildBroadcastContextDeepseekRequestBody(dummyRequest);
      expect(body.model).toBe("deepseek-v4-pro");
      expect(body.messages.length).toBe(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toContain("JSON 스키마");
      expect(body.messages[0].content).toContain("semanticChapters");
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toContain("총 방송 길이: 01:00:00");
      expect(body.messages[1].content).toContain("첫 번째 챕터 요약");
      expect(body.messages[1].content).toContain("==== 후보 ID: can1 ====");
      expect(body.response_format.type).toBe("json_object");
      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("high");
    });

    it("uses Qwen 3.7 Plus hybrid thinking without DeepSeek-only fields", () => {
      const body = buildBroadcastContextQwenRequestBody(dummyRequest);
      expect(body.model).toBe("qwen3.7-plus");
      expect(body.enable_thinking).toBe(true);
      expect(body.thinking_budget).toBe(4_096);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body).not.toHaveProperty("thinking");
      expect(body).not.toHaveProperty("reasoning_effort");
    });
  });

  describe("extractBroadcastContextDeepseekResponse", () => {
    it("parses valid response successfully with semantic chapters", () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "방송 전체 요약",
                recurringThemesKo: ["떡밥 1", "밈 2"],
                semanticChapters: [
                  {
                    startChapterId: "c1",
                    endChapterId: "c2",
                    titleKo: "의미 단락 제목",
                    summaryKo: "의미 단락 요약",
                    kind: "main-event",
                    salience: "primary",
                    relatedCandidateIds: ["can1"],
                    uncertaintiesKo: []
                  }
                ],
                annotations: [
                  {
                    candidateId: "can1",
                    category: "reaction",
                    clipDecision: "select",
                    confidence: 0.92,
                    rejectionReasons: [],
                    contextSummaryKo: "맥락",
                    whyThisMomentKo: "이유",
                    relatedCandidateIds: [],
                    uncertaintiesKo: ["불확실"],
                  },
                ],
              }),
            },
          },
        ],
      };

      const parsed = extractBroadcastContextDeepseekResponse(payload, dummyRequest);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.result.broadcastSummaryKo).toBe("방송 전체 요약");
        expect(parsed.result.annotations[0]?.category).toBe("reaction");
        expect(parsed.result.annotations[0]?.clipDecision).toBe("select");
        expect(parsed.result.semanticChaptersSupported).toBe(true);
        expect(parsed.result.semanticChapters.length).toBe(1);
        expect(parsed.result.semanticChapters[0]!.startMs).toBe(0);
        expect(parsed.result.semanticChapters[0]!.endMs).toBe(600000);
      }
    });

    it("rejects invalid category", () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "방송 전체 요약",
                recurringThemesKo: [],
                annotations: [
                  {
                    candidateId: "can1",
                    category: "invalid-category",
                    clipDecision: "reject",
                    confidence: 0.8,
                    rejectionReasons: ["no-distinct-event"],
                    contextSummaryKo: "맥락",
                    whyThisMomentKo: "이유",
                    relatedCandidateIds: [],
                    uncertaintiesKo: [],
                  },
                ],
              }),
            },
          },
        ],
      };

      const parsed = extractBroadcastContextDeepseekResponse(payload, dummyRequest);
      expect(parsed.ok).toBe(false);
    });

    it("accepts a fully negative broadcast without forcing a selected clip", () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "단편적인 진행만 이어져 독립적인 클립 사건이 없다.",
                recurringThemesKo: [],
                semanticChapters: [],
                annotations: [
                  {
                    candidateId: "can1",
                    category: "not-clip-worthy",
                    clipDecision: "reject",
                    confidence: 0.96,
                    rejectionReasons: ["no-distinct-event", "reaction-without-context"],
                    contextSummaryKo: "전체 흐름에서도 별도 사건으로 이어지지 않는다.",
                    whyThisMomentKo: "클립으로 선택할 근거가 없다.",
                    relatedCandidateIds: [],
                    uncertaintiesKo: [],
                  },
                ],
              }),
            },
          },
        ],
      };

      const parsed = extractBroadcastContextDeepseekResponse(payload, dummyRequest);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.result.annotations.every((item) => item.clipDecision === "reject")).toBe(true);
      }
    });

    it("discovers a quiet semantic lead even when the sound pass found no candidates", () => {
      const request: BroadcastContextRequest = {
        ...dummyRequest,
        candidates: [],
      };
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "조용히 목표를 달성한 뒤 결과를 확인한 방송이다.",
                recurringThemesKo: ["긴 도전의 마무리"],
                semanticChapters: [],
                discoveredLeads: [
                  {
                    leadId: "quiet-success-1",
                    startChapterId: "c1",
                    endChapterId: "c1",
                    category: "quiet-achievement",
                    confidence: 0.88,
                    eventSummaryKo: "오랜 시도 끝에 목표를 달성했다고 확인한다.",
                    whyThisMomentKo: "큰 소리 없이도 방송의 핵심 성취가 완결된다.",
                    evidenceCueKo: "됐다. 드디어 끝냈다.",
                    uncertaintiesKo: ["정확한 화면 확인 필요"],
                  },
                ],
                annotations: [],
              }),
            },
          },
        ],
      };

      const parsed = extractBroadcastContextDeepseekResponse(payload, request);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.result.annotations).toEqual([]);
        expect(parsed.result.discoveredLeadsSupported).toBe(true);
        expect(parsed.result.discoveredLeads[0]).toMatchObject({
          leadId: "quiet-success-1",
          startMs: 0,
          endMs: 300_000,
          category: "quiet-achievement",
        });
      }
    });

    it("rejects inconsistent decision reasons", () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "방송 전체 요약",
                recurringThemesKo: [],
                annotations: [
                  {
                    candidateId: "can1",
                    category: "not-clip-worthy",
                    clipDecision: "reject",
                    confidence: 0.9,
                    rejectionReasons: [],
                    contextSummaryKo: "맥락",
                    whyThisMomentKo: "이유",
                    relatedCandidateIds: [],
                    uncertaintiesKo: [],
                  },
                ],
              }),
            },
          },
        ],
      };

      expect(extractBroadcastContextDeepseekResponse(payload, dummyRequest).ok).toBe(false);
    });

    it("rejects unknown or duplicate candidate annotations", () => {
      const buildPayload = (candidateIds: readonly string[]) => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "방송 전체 요약",
                recurringThemesKo: [],
                annotations: candidateIds.map((candidateId) => ({
                  candidateId,
                  category: "not-clip-worthy",
                  clipDecision: "reject",
                  confidence: 0.9,
                  rejectionReasons: ["no-distinct-event"],
                  contextSummaryKo: "맥락",
                  whyThisMomentKo: "이유",
                  relatedCandidateIds: [],
                  uncertaintiesKo: [],
                })),
              }),
            },
          },
        ],
      });

      expect(
        extractBroadcastContextDeepseekResponse(buildPayload(["unknown"]), dummyRequest).ok,
      ).toBe(false);
      expect(
        extractBroadcastContextDeepseekResponse(buildPayload(["can1", "can1"]), dummyRequest).ok,
      ).toBe(false);
    });

    it("rejects missing fields", () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                broadcastSummaryKo: "방송 전체 요약",
                // recurringThemesKo missing
                annotations: [],
              }),
            },
          },
        ],
      };

      const parsed = extractBroadcastContextDeepseekResponse(payload, dummyRequest);
      expect(parsed.ok).toBe(false);
    });
  });
});
