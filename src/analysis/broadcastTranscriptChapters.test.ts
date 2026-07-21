import { describe, expect, it } from "vitest";
import { calculateCoverage } from "./broadcastContextProtocol";
import { createBroadcastTranscriptChapters } from "./broadcastTranscriptChapters";

describe("broadcastTranscriptChapters", () => {
  it("preserves ASR source fences and reports true full coverage", () => {
    const chapters = createBroadcastTranscriptChapters(
      [
        {
          schemaVersion: "1.0.0",
          modelId: "qwen3-asr-flash",
          sourceStartMs: 0,
          sourceEndMs: 210_000,
          textKo: "첫 구간에서 음식 이야기를 시작한다.",
          detectedLanguage: "ko",
          emotion: "neutral",
          billedSeconds: 210,
        },
        {
          schemaVersion: "1.0.0",
          modelId: "qwen3-asr-flash",
          sourceStartMs: 210_000,
          sourceEndMs: 300_000,
          textKo: "두 번째 구간에서 조용히 성공한다.",
          detectedLanguage: "ko",
          emotion: "happy",
          billedSeconds: 90,
        },
      ],
      300_000,
      true,
    );
    expect(chapters[1]).toMatchObject({
      chapterId: "transcript-002",
      startMs: 210_000,
      endMs: 300_000,
      evidenceMode: "complete-transcript",
    });
    expect(chapters[1]?.summaryKo).toContain("[감정 단서: happy]");
    expect(calculateCoverage(chapters, 300_000).status).toBe("complete");
  });

  it("keeps unsampled source ranges visible as coverage gaps", () => {
    const chapters = createBroadcastTranscriptChapters(
      [
        {
          schemaVersion: "1.0.0",
          modelId: "qwen3-asr-flash",
          sourceStartMs: 100_000,
          sourceEndMs: 150_000,
          textKo: "표본 대사",
          detectedLanguage: "ko",
          emotion: null,
          billedSeconds: 50,
        },
      ],
      600_000,
      false,
    );
    expect(calculateCoverage(chapters, 600_000).gaps).toEqual([
      { startMs: 0, endMs: 100_000 },
      { startMs: 150_000, endMs: 600_000 },
    ]);
  });
});
