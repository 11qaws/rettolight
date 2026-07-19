import { describe, expect, it } from "vitest";

import type { NormalizedChatMessage } from "./chatImport";
import { selectChatHighlights } from "./highlightSelector";

function message(timestampMs: number, text: string, authorNumber: number): NormalizedChatMessage {
  return { timestampMs, text, authorId: `author_${authorNumber}` };
}

function quietBaseline(durationMs: number): NormalizedChatMessage[] {
  const messages: NormalizedChatMessage[] = [];
  for (let timestampMs = 2500; timestampMs < durationMs; timestampMs += 5000) {
    messages.push(message(timestampMs, "평범한 대화", timestampMs));
  }
  return messages;
}

function addCollectiveSpike(
  messages: NormalizedChatMessage[],
  bucketStartMs: number,
  count: number,
  authorSeed: number,
): void {
  const reactions = ["와 대박", "ㅋㅋ 진짜", "미쳤다", "레전드", "헐 뭐야"];
  for (let index = 0; index < count; index += 1) {
    messages.push(
      message(
        bucketStartMs + 100 + index * 100,
        reactions[index % reactions.length] ?? "와",
        authorSeed + index,
      ),
    );
  }
}

describe("selectChatHighlights", () => {
  it("selects a clear synthetic collective chat spike", () => {
    const messages = quietBaseline(120_000);
    addCollectiveSpike(messages, 60_000, 14, 1000);

    const result = selectChatHighlights(messages, { sourceDurationMs: 120_000 });

    expect(result.mode).toBe("chat-signals-only");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      peakMs: 62_500,
      startMs: 42_500,
      endMs: 87_500,
    });
    expect(result.candidates[0]?.evidence.messageCount).toBe(15);
    expect(result.candidates[0]?.evidence.uniqueAuthorCount).toBeGreaterThan(10);
    expect(result.candidates[0]?.reason).toContain("검토 후보");
    expect(JSON.stringify(result.candidates)).not.toContain("와 대박");
    expect(JSON.stringify(result.candidates)).not.toContain("author_");
  });

  it("can explicitly clamp offset messages while keeping candidate windows in the source", () => {
    const messages = quietBaseline(100_000);
    addCollectiveSpike(messages, -5000, 10, 2000);
    addCollectiveSpike(messages, 95_000, 11, 3000);
    messages.push(message(200_000, "범위 밖 메시지", 9000));

    const result = selectChatHighlights(messages, {
      sourceDurationMs: 100_000,
      chatOffsetMs: 5000,
      maxCandidates: 3,
      outOfRangeMode: "clamp",
    });

    expect(result.clampedMessageCount).toBeGreaterThan(0);
    expect(result.outOfRangeMessageCount).toBe(result.clampedMessageCount);
    expect(result.candidates.some((candidate) => candidate.startMs === 0)).toBe(true);
    expect(result.candidates.some((candidate) => candidate.endMs === 100_000)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.endMs <= 100_000)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.startMs >= 0)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.endMs - candidate.startMs === 45_000)).toBe(
      true,
    );
  });

  it("excludes out-of-range chat by default instead of creating a boundary spike", () => {
    const result = selectChatHighlights(
      [
        message(-5_000, "outside before", 1),
        message(10_000, "inside", 2),
        message(80_000, "outside after", 3),
      ],
      { sourceDurationMs: 60_000 },
    );

    expect(result.analyzedMessageCount).toBe(1);
    expect(result.outOfRangeMessageCount).toBe(2);
    expect(result.clampedMessageCount).toBe(0);
  });

  it("uses the whole source only when it is shorter than the default candidate window", () => {
    const messages = quietBaseline(25_000);
    addCollectiveSpike(messages, 0, 10, 3500);

    const result = selectChatHighlights(messages, {
      sourceDurationMs: 25_000,
      maxCandidates: 1,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ startMs: 0, endMs: 25_000 });
    expect((result.candidates[0]?.endMs ?? 0) - (result.candidates[0]?.startMs ?? 0)).toBe(
      25_000,
    );
  });

  it("penalizes a repeated single-author spam burst", () => {
    const messages = quietBaseline(150_000);
    for (let index = 0; index < 30; index += 1) {
      messages.push(message(30_000 + index * 50, "ㅋㅋㅋㅋㅋㅋ", 1));
    }
    addCollectiveSpike(messages, 100_000, 12, 4000);

    const result = selectChatHighlights(messages, {
      sourceDurationMs: 150_000,
      maxCandidates: 4,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.peakMs).toBe(102_500);
    expect(result.candidates[0]?.evidence.uniqueAuthorCount).toBeGreaterThan(5);
  });

  it("returns stable score ordering, deterministic IDs, non-overlapping ranges, and max count", () => {
    const messages = quietBaseline(240_000);
    addCollectiveSpike(messages, 60_000, 12, 5000);
    addCollectiveSpike(messages, 150_000, 12, 6000);
    addCollectiveSpike(messages, 210_000, 9, 7000);
    const options = { sourceDurationMs: 240_000, maxCandidates: 2 } as const;

    const first = selectChatHighlights(messages, options);
    const second = selectChatHighlights(messages, options);

    expect(first.candidates).toEqual(second.candidates);
    expect(first.candidates).toHaveLength(2);
    expect(new Set(first.candidates.map((candidate) => candidate.id)).size).toBe(2);
    expect(first.candidates[0]?.score).toBeGreaterThanOrEqual(first.candidates[1]?.score ?? 0);
    const [left, right] = [...first.candidates].sort((a, b) => a.startMs - b.startMs);
    expect(left?.endMs).toBeLessThanOrEqual(right?.startMs ?? Number.POSITIVE_INFINITY);
  });

  it("returns no candidates for empty or flat no-signal input", () => {
    const empty = selectChatHighlights([], { sourceDurationMs: 60_000 });
    const flat = selectChatHighlights(quietBaseline(120_000), {
      sourceDurationMs: 120_000,
    });

    expect(empty.candidates).toEqual([]);
    expect(empty.analyzedMessageCount).toBe(0);
    expect(flat.candidates).toEqual([]);
  });

  it("does not create duplicate overlapping candidates from adjacent spike buckets", () => {
    const messages = quietBaseline(120_000);
    addCollectiveSpike(messages, 50_000, 10, 8000);
    addCollectiveSpike(messages, 55_000, 11, 9000);

    const result = selectChatHighlights(messages, {
      sourceDurationMs: 120_000,
      maxCandidates: 5,
    });

    expect(result.candidates).toHaveLength(1);
  });
});
