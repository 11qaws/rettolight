import { describe, expect, it } from "vitest";
import type { TemporalEventDensityBin } from "./temporalPointProcess";
import {
  buildEventEpisodes,
  selectContextAwareCandidates,
  type SelectableCandidate,
} from "./contextAwareCandidateSelection";

const MINUTE_MS = 60_000;

function candidate(
  id: string,
  minute: number,
  score: number,
  options: Partial<SelectableCandidate> = {},
): SelectableCandidate {
  const peakMs = minute * MINUTE_MS;
  return {
    id,
    peakMs,
    startMs: peakMs - 20_000,
    endMs: peakMs + 25_000,
    score,
    signalKinds: ["audio"],
    evidence: { audio: { eventKind: "sustained-vocal-reaction" } },
    ...options,
  };
}

function densityBins(
  durationMinutes: number,
  expectedByFiveMinutes: readonly number[],
): TemporalEventDensityBin[] {
  return expectedByFiveMinutes.map((expectedEventCount, index) => ({
    startMs: index * 5 * MINUTE_MS,
    endMs: Math.min((index + 1) * 5 * MINUTE_MS, durationMinutes * MINUTE_MS),
    eventCount: Math.round(expectedEventCount),
    expectedEventCount,
    poissonTailProbability: null,
    densityClass: "normal",
  }));
}

describe("buildEventEpisodes", () => {
  it("collapses detector fragments from one event before density estimation", () => {
    const fragments = [
      candidate("fragment-a", 10, 0.7),
      candidate("fragment-b", 10.3, 0.95),
      candidate("unrelated", 20, 0.8),
    ];

    const episodes = buildEventEpisodes(fragments);

    expect(episodes).toHaveLength(2);
    expect(episodes[0]?.representative.id).toBe("fragment-b");
    expect(episodes[0]?.memberCandidateIds).toEqual(["fragment-a", "fragment-b"]);
  });

  it("does not create an unbounded transitive episode chain", () => {
    const chained = [
      candidate("a", 1, 0.7, {
        startMs: 40_000,
        endMs: 85_000,
        evidenceKeys: ["shared-scene"],
      }),
      candidate("b", 2, 0.8, {
        startMs: 90_000,
        endMs: 130_000,
        evidenceKeys: ["shared-scene"],
      }),
      candidate("c", 3, 0.9, {
        startMs: 145_000,
        endMs: 190_000,
        evidenceKeys: ["shared-scene"],
      }),
    ];

    const episodes = buildEventEpisodes(chained);

    expect(episodes).toHaveLength(2);
    expect(episodes[0]?.memberCandidateIds).toEqual(["a", "b"]);
    expect(episodes[1]?.memberCandidateIds).toEqual(["c"]);
  });

  it("does not treat a generic vocal detector kind as event identity", () => {
    const episodes = buildEventEpisodes([
      candidate("reaction-a", 10, 0.8),
      candidate("reaction-b", 10.8, 0.9),
    ]);

    expect(episodes).toHaveLength(2);
  });
});

describe("selectContextAwareCandidates", () => {
  it("may return zero instead of filling the budget for negative ground truth", () => {
    const reservoir = [
      candidate("relay-a", 10, 0.96),
      candidate("relay-b", 40, 0.92),
      candidate("relay-c", 80, 0.89),
    ];
    const result = selectContextAwareCandidates(
      reservoir,
      120 * MINUTE_MS,
      densityBins(120, new Array(24).fill(1)),
      [],
      {
        detailAnalysisBudget: 12,
        candidateEligibilityById: {
          "relay-a": "ineligible",
          "relay-b": "ineligible",
          "relay-c": "ineligible",
        },
      },
    );

    expect(result.candidates).toEqual([]);
    expect(result.summary.rejectedIneligibleCount).toBe(3);
    expect(result.summary.unfilledBudget).toBe(12);
  });

  it("keeps a quiet semantic target without letting exploration force weak fillers", () => {
    const reservoir = [
      candidate("obvious", 5, 0.9),
      candidate("exact-apology", 65, 0.45, { signalKinds: ["audio", "semantic"] }),
      candidate("meaningless", 95, 0.99),
    ];
    const result = selectContextAwareCandidates(
      reservoir,
      120 * MINUTE_MS,
      densityBins(120, new Array(24).fill(1)),
      ["exact-apology"],
      {
        detailAnalysisBudget: 4,
        explorationShare: 0.25,
        candidateEligibilityById: {
          obvious: "eligible",
          "exact-apology": "exploration",
          meaningless: "ineligible",
        },
      },
    );

    expect(result.candidates.map((item) => item.id)).toEqual([
      "obvious",
      "exact-apology",
    ]);
    expect(result.summary.unfilledBudget).toBe(2);
  });

  it("uses soft density coverage and still allows several strong distinct events", () => {
    const reservoir = [
      candidate("dense-1", 5, 1),
      candidate("dense-2", 7, 0.98),
      candidate("dense-3", 9, 0.96),
      candidate("quiet-1", 65, 0.7),
      candidate("quiet-2", 95, 0.65),
    ];
    const result = selectContextAwareCandidates(
      reservoir,
      120 * MINUTE_MS,
      densityBins(120, [
        10,
        10,
        10,
        10,
        ...Array.from({ length: 20 }, () => 0.2),
      ]),
      [],
      { detailAnalysisBudget: 4, explorationShare: 0.25 },
    );

    const ids = result.candidates.map((item) => item.id);
    expect(ids.filter((id) => id.startsWith("dense")).length).toBeGreaterThanOrEqual(2);
    expect(ids).toContain("quiet-1");
    expect(result.candidates).toHaveLength(4);
  });

  it("applies an absolute quality floor before relative normalization", () => {
    const result = selectContextAwareCandidates(
      [candidate("low-a", 5, 0.15), candidate("low-b", 50, 0.2)],
      60 * MINUTE_MS,
      densityBins(60, new Array(12).fill(1)),
      [],
      { detailAnalysisBudget: 12, minimumAbsoluteScore: 0.4 },
    );

    expect(result.candidates).toEqual([]);
    expect(result.summary.rejectedBelowQualityCount).toBe(2);
  });

  it("is deterministic when the reservoir input order changes", () => {
    const reservoir = [
      candidate("a", 5, 0.9),
      candidate("b", 25, 0.85, { signalKinds: ["chat"] }),
      candidate("c", 55, 0.8),
      candidate("d", 85, 0.75, { signalKinds: ["visual", "audio"] }),
      candidate("e", 110, 0.7),
    ];
    const bins = densityBins(120, new Array(24).fill(1));
    const first = selectContextAwareCandidates(reservoir, 120 * MINUTE_MS, bins, [], {
      detailAnalysisBudget: 4,
    });
    const shuffled = selectContextAwareCandidates(
      [reservoir[3]!, reservoir[0]!, reservoir[4]!, reservoir[1]!, reservoir[2]!],
      120 * MINUTE_MS,
      bins,
      [],
      { detailAnalysisBudget: 4 },
    );

    expect(shuffled.candidates.map((item) => item.id)).toEqual(
      first.candidates.map((item) => item.id),
    );
    expect(shuffled.diagnostics).toEqual(first.diagnostics);
  });

  it("never exceeds the detail-analysis budget for a large reservoir", () => {
    const reservoir = Array.from({ length: 96 }, (_, index) =>
      candidate(`candidate-${index}`, index * 6 + 1, 1 - index / 200),
    );
    const result = selectContextAwareCandidates(
      reservoir,
      12 * 60 * MINUTE_MS,
      densityBins(12 * 60, new Array(144).fill(1)),
      [],
      { detailAnalysisBudget: 12 },
    );

    expect(result.candidates).toHaveLength(12);
    expect(result.summary.eventEpisodeCount).toBe(96);
  });
});
