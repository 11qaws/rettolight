import { describe, expect, it } from "vitest";
import { compactBroadcastContextChapters } from "./broadcastContextChapterCompaction";
import type { BroadcastContextChapterInput } from "./broadcastContextProtocol";

function chapter(index: number): BroadcastContextChapterInput {
  return {
    chapterId: `raw-${index}`,
    startMs: index * 30_000,
    endMs: (index + 1) * 30_000,
    evidenceMode: "complete-transcript",
    evidenceCoverageRatio: 1,
    summaryKo: `구간 ${index}에서 확인한 실제 대사와 사건`,
  };
}

describe("compactBroadcastContextChapters", () => {
  it("keeps an already bounded durable map unchanged", () => {
    const chapters = Array.from({ length: 12 }, (_, index) => chapter(index));
    expect(compactBroadcastContextChapters(chapters)).toBe(chapters);
  });

  it("projects a legacy 240-cell checkpoint into 144 ordered source ranges", () => {
    const chapters = Array.from({ length: 240 }, (_, index) => chapter(index));
    const compacted = compactBroadcastContextChapters(chapters);
    expect(compacted).toHaveLength(144);
    expect(compacted[0]).toMatchObject({ startMs: 0, evidenceCoverageRatio: 1 });
    expect(compacted.at(-1)).toMatchObject({ endMs: 7_200_000 });
    expect(
      compacted.every(
        (current, index) =>
          index === 0 || current.startMs >= compacted[index - 1]!.endMs,
      ),
    ).toBe(true);
    expect(compacted.some(({ summaryKo }) => summaryKo.includes("실제 대사"))).toBe(true);
  });

  it("marks merged gaps as sampled evidence and lowers coverage", () => {
    const compacted = compactBroadcastContextChapters(
      [
        chapter(0),
        { ...chapter(2), chapterId: "raw-gap" },
        chapter(3),
      ],
      1,
    );
    expect(compacted[0]?.evidenceMode).toBe("sampled-audio-video");
    expect(compacted[0]?.evidenceCoverageRatio).toBeCloseTo(0.75);
  });
});
