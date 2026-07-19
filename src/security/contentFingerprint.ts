export interface ContentDigestAdapter {
  digest(algorithm: "SHA-256", data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
}
function lengthDelimited(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("|");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fallbackFingerprint(value: string): string {
  let high = 0x811c9dc5;
  let low = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    low = Math.imul(low ^ codePoint, 0x01000193) >>> 0;
    high = Math.imul(high ^ (codePoint + index), 0x85ebca6b) >>> 0;
  }
  return `local-fallback:${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`;
}

export async function createContentFingerprint(
  parts: readonly string[],
  adapter: ContentDigestAdapter | null = globalThis.crypto?.subtle ?? null,
): Promise<string> {
  const framed = lengthDelimited(parts);
  if (adapter === null) {
    return fallbackFingerprint(framed);
  }
  const encoded = new TextEncoder().encode(framed);
  const digest = await adapter.digest("SHA-256", encoded);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}
