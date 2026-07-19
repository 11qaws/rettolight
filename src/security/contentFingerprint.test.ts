import { describe, expect, it } from "vitest";

import { createContentFingerprint } from "./contentFingerprint";

describe("createContentFingerprint", () => {
  it("is deterministic and keeps part boundaries unambiguous", async () => {
    const first = await createContentFingerprint(["ab", "c"]);
    const again = await createContentFingerprint(["ab", "c"]);
    const differentBoundary = await createContentFingerprint(["a", "bc"]);

    expect(first).toBe(again);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(differentBoundary).not.toBe(first);
  });

  it("has a deterministic local fallback when SubtleCrypto is unavailable", async () => {
    await expect(createContentFingerprint(["local", "only"], null)).resolves.toMatch(
      /^local-fallback:[0-9a-f]{16}$/u,
    );
  });
});
