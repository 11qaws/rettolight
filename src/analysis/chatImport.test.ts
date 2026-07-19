import { describe, expect, it } from "vitest";

import { parseChatImport } from "./chatImport";

describe("parseChatImport", () => {
  it("parses a JSON array and normalizes relative seconds and milliseconds", () => {
    const result = parseChatImport(
      JSON.stringify([
        { relativeSeconds: 1.5, content: "첫 메시지", nickname: "Alice" },
        { relativeMs: 2500, text: "두 번째", author: "Bob" },
      ]),
    );

    expect(result.format).toBe("json");
    expect(result.timestampBasis).toBe("relative");
    expect(result.messages.map((message) => message.timestampMs)).toEqual([1500, 2500]);
    expect(result.messages[0]?.authorId).toMatch(/^author_[0-9]{6}$/);
    expect(result.messages[0]?.authorId).not.toBe("Alice");
    expect(JSON.stringify(result.diagnostics)).not.toContain("Alice");
    expect(result.invalidRowCount).toBe(0);
  });

  it("parses an object with messages and HH:MM:SS timestamps", () => {
    const result = parseChatImport(
      JSON.stringify({
        messages: [{ time: "01:02:03.500", message: "시간 형식", user: { name: "viewer" } }],
      }),
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.timestampMs).toBe(3_723_500);
    expect(result.messages[0]?.authorId).toMatch(/^author_/);
  });

  it("keeps valid JSONL rows while counting malformed and invalid rows", () => {
    const input = [
      '{"relativeMs":1000,"content":"정상","sender":"first"}',
      "not-json",
      '{"relativeMs":2000,"content":""}',
      '{"relativeMs":3000,"content":"다시 정상","sender":"second"}',
    ].join("\n");

    const result = parseChatImport(input);

    expect(result.format).toBe("jsonl");
    expect(result.messages.map((message) => message.timestampMs)).toEqual([1000, 3000]);
    expect(result.totalRowCount).toBe(4);
    expect(result.invalidRowCount).toBe(2);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "invalidJsonLine",
      "invalidRow",
    ]);
  });

  it("parses quoted CSV fields containing commas, escaped quotes, and author aliases", () => {
    const input = [
      "timestamp,text,username",
      '00:00:01.250,"와, 진짜 ""대박""","사용자,1"',
      '00:00:03.000,"두 번째 줄",viewer2',
    ].join("\r\n");

    const result = parseChatImport(input);

    expect(result.format).toBe("csv");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      timestampMs: 1250,
      text: '와, 진짜 "대박"',
    });
    expect(result.messages[0]?.authorId).not.toContain("사용자");
    expect(JSON.stringify(result.diagnostics)).not.toContain("사용자,1");
  });

  it("marks ISO absolute timestamps as rebasedAbsolute and warns explicitly", () => {
    const result = parseChatImport(
      JSON.stringify([
        { timestamp: "2026-07-19T10:00:10.000Z", message: "첫째", author: "a" },
        { timestamp: "2026-07-19T10:00:12.500Z", message: "둘째", author: "b" },
      ]),
    );

    expect(result.timestampBasis).toBe("rebasedAbsolute");
    expect(result.messages.map((message) => message.timestampMs)).toEqual([0, 2500]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "absoluteTimestampRebased",
      }),
    );
  });

  it("recognizes epoch seconds as absolute timestamps and rebases to the first message", () => {
    const result = parseChatImport(
      JSON.stringify([
        { ts: 1_750_000_000, text: "하나" },
        { ts: 1_750_000_003, text: "둘" },
      ]),
    );

    expect(result.timestampBasis).toBe("rebasedAbsolute");
    expect(result.messages.map((message) => message.timestampMs)).toEqual([0, 3000]);
  });

  it("returns diagnostics instead of throwing for invalid rows", () => {
    const result = parseChatImport(
      JSON.stringify([
        null,
        { time: "잘못된 시각", content: "메시지" },
        { relativeSeconds: 3 },
        { relativeSeconds: 4, content: "정상", nickname: "비밀닉네임" },
      ]),
    );

    expect(result.messages).toHaveLength(1);
    expect(result.invalidRowCount).toBe(3);
    expect(result.totalRowCount).toBe(4);
    expect(JSON.stringify(result.diagnostics)).not.toContain("비밀닉네임");
  });
});
