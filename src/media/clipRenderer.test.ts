import { describe, expect, it } from "vitest";

import {
  ClipRenderError,
  buildClipBaseName,
  buildClipFileName,
  inferClipOutputKind,
  validateClipTimeRange,
} from "./clipRenderer";

describe("clip renderer helpers", () => {
  it("uses WebM output for WebM sources and MP4 otherwise", () => {
    expect(inferClipOutputKind({ name: "stream.webm", type: "" })).toBe("webm");
    expect(inferClipOutputKind({ name: "stream.bin", type: "video/webm" })).toBe("webm");
    expect(inferClipOutputKind({ name: "stream.mp4", type: "video/mp4" })).toBe("mp4");
  });

  it("formats deterministic candidate filenames", () => {
    expect(
      buildClipFileName(
        3,
        { startMs: 3_661_000, endMs: 3_721_000 },
        "mp4",
      ),
    ).toBe("exclipper-03-01-01-01-01-02-01.mp4");
  });

  it("slugifies a title into the base filename when one is given", () => {
    expect(
      buildClipBaseName(3, { startMs: 3_661_000, endMs: 3_721_000 }, "칼국수 먹방 사건"),
    ).toBe("exclipper-03-칼국수-먹방-사건");
    expect(
      buildClipFileName(3, { startMs: 3_661_000, endMs: 3_721_000 }, "mp4", "칼국수 먹방 사건"),
    ).toBe("exclipper-03-칼국수-먹방-사건.mp4");
  });

  it("falls back to the timecode form for an empty or unsafe-only title", () => {
    expect(buildClipBaseName(3, { startMs: 3_661_000, endMs: 3_721_000 }, "")).toBe(
      "exclipper-03-01-01-01-01-02-01",
    );
    expect(buildClipBaseName(3, { startMs: 3_661_000, endMs: 3_721_000 }, "   ")).toBe(
      "exclipper-03-01-01-01-01-02-01",
    );
    expect(buildClipBaseName(3, { startMs: 3_661_000, endMs: 3_721_000 }, "///???")).toBe(
      "exclipper-03-01-01-01-01-02-01",
    );
  });

  it("strips filesystem-unsafe characters and caps the slug length", () => {
    const longTitle = "a".repeat(60);
    expect(buildClipBaseName(1, { startMs: 0, endMs: 1_000 }, longTitle)).toBe(
      `exclipper-01-${"a".repeat(40)}`,
    );
    expect(
      buildClipBaseName(1, { startMs: 0, endMs: 1_000 }, 'bad/name:with*chars?"<>|'),
    ).toBe("exclipper-01-badnamewithchars");
  });

  it("rejects invalid ranges before opening media", () => {
    expect(() => validateClipTimeRange({ startMs: 10_000, endMs: 10_000 })).toThrowError(
      ClipRenderError,
    );
    expect(() => validateClipTimeRange({ startMs: -1, endMs: 10_000 })).toThrowError(
      ClipRenderError,
    );
    expect(() => validateClipTimeRange({ startMs: 10_000.5, endMs: 20_000 })).toThrowError(
      ClipRenderError,
    );
  });
});
