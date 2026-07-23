import { describe, expect, it } from "vitest";

import type { CandidatePassBPresentationCue } from "../analysis/candidatePassBPresentation";
import { assessClipSubtitleCoverage, buildClipSrt } from "./clipSubtitles";

function cue(
  absoluteStartMs: number,
  absoluteEndMs: number,
  text: string,
): CandidatePassBPresentationCue {
  return { phase: "near-peak", phaseLabel: "반응 시점 부근", absoluteStartMs, absoluteEndMs, text };
}

describe("assessClipSubtitleCoverage", () => {
  it("is unavailable with no cues", () => {
    const result = assessClipSubtitleCoverage([], { startMs: 0, endMs: 10_000 });
    expect(result.available).toBe(false);
    expect(result.reason).toContain("확인된 대사 단서가 없어요");
  });

  it("is unavailable when cues only cover a small fraction of the clip", () => {
    const result = assessClipSubtitleCoverage(
      [cue(0, 1_000, "짧은 한마디")],
      { startMs: 0, endMs: 10_000 },
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("일부만");
  });

  it("is available when cues cover most of the clip, merging overlaps", () => {
    const result = assessClipSubtitleCoverage(
      [cue(0, 4_000, "첫 대사"), cue(3_500, 8_000, "겹치는 대사")],
      { startMs: 0, endMs: 10_000 },
    );
    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("ignores cue time outside the requested clip range", () => {
    const result = assessClipSubtitleCoverage(
      [cue(-5_000, 9_000, "구간 밖까지 걸친 대사")],
      { startMs: 0, endMs: 10_000 },
    );
    expect(result.available).toBe(true);
  });
});

describe("buildClipSrt", () => {
  it("rebases absolute cue timestamps to the clip's own start", () => {
    const srt = buildClipSrt(
      [cue(65_000, 68_000, "안녕하세요"), cue(70_000, 72_500, "확인해 주세요")],
      { startMs: 60_000, endMs: 80_000 },
    );
    expect(srt).toContain("1\r\n00:00:05,000 --> 00:00:08,000\r\n안녕하세요\r\n");
    expect(srt).toContain("2\r\n00:00:10,000 --> 00:00:12,500\r\n확인해 주세요\r\n");
  });

  it("clips a cue that starts before the range to the range boundary", () => {
    const srt = buildClipSrt([cue(58_000, 63_000, "경계 걸친 대사")], {
      startMs: 60_000,
      endMs: 80_000,
    });
    expect(srt).toContain("00:00:00,000 --> 00:00:03,000");
  });

  it("orders blocks chronologically regardless of input order", () => {
    const srt = buildClipSrt(
      [cue(70_000, 72_000, "나중 대사"), cue(60_000, 62_000, "먼저 대사")],
      { startMs: 60_000, endMs: 80_000 },
    );
    expect(srt.indexOf("먼저 대사")).toBeLessThan(srt.indexOf("나중 대사"));
  });
});
