import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
  DEFAULT_LOCAL_FILE_FINGERPRINT_CHUNK_SIZE_BYTES,
  DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
  DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT,
  LOCAL_FILE_FINGERPRINT_VERSION,
  createLocalFileFingerprint,
  planLocalFileFingerprintSamples,
  type LocalFileFingerprintProgress,
  type LocalFileFingerprintSource,
} from "./localFileFingerprint";

describe("planLocalFileFingerprintSamples", () => {
  it("places fixed windows at the beginning, evenly through the middle, and at the end", () => {
    const plan = planLocalFileFingerprintSamples(1_000, {
      sampleCount: 3,
      chunkSizeBytes: 100,
      maxReadBytes: 300,
    });

    expect(plan).toEqual({
      sourceSizeBytes: 1_000,
      sampledBytes: 300,
      windows: [
        { offsetBytes: 0, lengthBytes: 100 },
        { offsetBytes: 450, lengthBytes: 100 },
        { offsetBytes: 900, lengthBytes: 100 },
      ],
    });
  });

  it("reads a small file in full once and handles an empty file without a read", () => {
    expect(
      planLocalFileFingerprintSamples(11, {
        sampleCount: 3,
        chunkSizeBytes: 4,
        maxReadBytes: 12,
      }),
    ).toEqual({
      sourceSizeBytes: 11,
      sampledBytes: 11,
      windows: [{ offsetBytes: 0, lengthBytes: 11 }],
    });

    expect(planLocalFileFingerprintSamples(0)).toEqual({
      sourceSizeBytes: 0,
      sampledBytes: 0,
      windows: [],
    });
  });

  it("enforces an absolute source-read ceiling even when options are customized", () => {
    expect(() =>
      planLocalFileFingerprintSamples(20_000_000, {
        maxReadBytes: ABSOLUTE_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES + 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
  });
});

describe("createLocalFileFingerprint", () => {
  it("is deterministic and ignores file name and last-modified metadata", async () => {
    const bytes = new TextEncoder().encode("same local video bytes");
    const firstSource = Object.assign(new Blob([bytes]), {
      name: "first-name.mp4",
      lastModified: 1,
    });
    const renamedSource = Object.assign(new Blob([bytes]), {
      name: "renamed-video.webm",
      lastModified: 9_999_999,
    });

    const first = await createLocalFileFingerprint(firstSource);
    const again = await createLocalFileFingerprint(firstSource);
    const renamed = await createLocalFileFingerprint(renamedSource);

    expect(first.value).toBe(again.value);
    expect(renamed.value).toBe(first.value);
    expect(first.value).toMatch(
      new RegExp(`^${LOCAL_FILE_FINGERPRINT_VERSION}:[0-9a-f]{64}$`, "u"),
    );
    expect(first.version).toBe(LOCAL_FILE_FINGERPRINT_VERSION);
  });

  it("detects changes in the sampled beginning, middle, and final windows", async () => {
    const options = {
      sampleCount: 3,
      chunkSizeBytes: 10,
      maxReadBytes: 30,
    } as const;
    const originalBytes = new Uint8Array(100);
    const original = await createLocalFileFingerprint(
      new Blob([originalBytes]),
      options,
    );

    for (const changedIndex of [0, 49, 99]) {
      const changedBytes = originalBytes.slice();
      changedBytes[changedIndex] = 1;
      const changed = await createLocalFileFingerprint(
        new Blob([changedBytes]),
        options,
      );
      expect(changed.value, `changed byte ${changedIndex}`).not.toBe(
        original.value,
      );
    }
  });

  it("keeps actual source reads within the default budget and reports progress", async () => {
    const sourceBlob = new Blob([new Uint8Array(2_000_000)]);
    const requestedReads: number[] = [];
    const source: LocalFileFingerprintSource = {
      size: sourceBlob.size,
      slice(start, end) {
        requestedReads.push(end - start);
        return sourceBlob.slice(start, end);
      },
    };
    const progress: LocalFileFingerprintProgress[] = [];

    const result = await createLocalFileFingerprint(source, {
      onProgress: (update) => progress.push(update),
    });

    expect(requestedReads).toHaveLength(
      DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT,
    );
    expect(requestedReads).toEqual(
      Array.from(
        { length: DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT },
        () => DEFAULT_LOCAL_FILE_FINGERPRINT_CHUNK_SIZE_BYTES,
      ),
    );
    expect(requestedReads.reduce((total, value) => total + value, 0)).toBe(
      DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
    );
    expect(result.sampledBytes).toBe(
      DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
    );
    expect(progress.at(0)).toMatchObject({
      phase: "reading",
      completedSamples: 0,
      bytesRead: 0,
    });
    expect(progress.at(-2)?.phase).toBe("digesting");
    expect(progress.at(-1)).toEqual({
      phase: "completed",
      completedSamples: DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT,
      totalSamples: DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT,
      bytesRead: DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
      totalBytesToRead: DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES,
    });
  });

  it("rejects promptly when cancellation happens during a pending source read", async () => {
    const controller = new AbortController();
    const delayedChunk = new Blob([new Uint8Array(10)]);
    Object.defineProperty(delayedChunk, "arrayBuffer", {
      configurable: true,
      value: () => new Promise<ArrayBuffer>(() => undefined),
    });
    const source: LocalFileFingerprintSource = {
      size: 100,
      slice: () => delayedChunk,
    };

    const pending = createLocalFileFingerprint(source, {
      sampleCount: 3,
      chunkSizeBytes: 10,
      maxReadBytes: 30,
      signal: controller.signal,
    });
    controller.abort("test cancellation");

    await expect(pending).rejects.toMatchObject({
      name: "LocalFileFingerprintError",
      code: "ABORTED",
    });
  });

  it("does not silently downgrade when SHA-256 Web Crypto is unavailable", async () => {
    await expect(
      createLocalFileFingerprint(new Blob(["video"]), {
        digestAdapter: null,
      }),
    ).rejects.toMatchObject({
      name: "LocalFileFingerprintError",
      code: "CRYPTO_UNAVAILABLE",
    });
  });
});
