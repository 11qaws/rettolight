import type { ContentDigestAdapter } from "./contentFingerprint";

export const LOCAL_FILE_FINGERPRINT_VERSION = "local-file-sampled-sha256-v1";
export const DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT = 9;
export const DEFAULT_LOCAL_FILE_FINGERPRINT_CHUNK_SIZE_BYTES = 64 * 1024;
export const DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES =
  DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT *
  DEFAULT_LOCAL_FILE_FINGERPRINT_CHUNK_SIZE_BYTES;
export const ABSOLUTE_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES = 8 * 1024 * 1024;

const MIN_SAMPLE_COUNT = 3;
const MAX_SAMPLE_COUNT = 64;

export type LocalFileFingerprintErrorCode =
  | "ABORTED"
  | "INVALID_SOURCE"
  | "INVALID_OPTIONS"
  | "CRYPTO_UNAVAILABLE"
  | "READ_FAILED"
  | "DIGEST_FAILED"
  | "PROGRESS_CALLBACK_FAILED";

export class LocalFileFingerprintError extends Error {
  public readonly code: LocalFileFingerprintErrorCode;
  public readonly originalCause: unknown;

  public constructor(
    code: LocalFileFingerprintErrorCode,
    message: string,
    options: { readonly cause?: unknown } = {},
  ) {
    super(message);
    this.name = "LocalFileFingerprintError";
    this.code = code;
    this.originalCause = options.cause;
  }
}

/**
 * The deliberately small surface used from Blob/File. A File satisfies this
 * contract, while tests can provide a delayed reader without DOM fixtures.
 */
export interface LocalFileFingerprintSource {
  readonly size: number;
  slice(start: number, end: number): Blob;
}

export interface LocalFileFingerprintSampleWindow {
  readonly offsetBytes: number;
  readonly lengthBytes: number;
}

export interface LocalFileFingerprintSamplingOptions {
  readonly sampleCount?: number;
  readonly chunkSizeBytes?: number;
  readonly maxReadBytes?: number;
}

export interface LocalFileFingerprintPlan {
  readonly sourceSizeBytes: number;
  readonly sampledBytes: number;
  readonly windows: readonly LocalFileFingerprintSampleWindow[];
}

export type LocalFileFingerprintProgressPhase =
  | "reading"
  | "digesting"
  | "completed";

export interface LocalFileFingerprintProgress {
  readonly phase: LocalFileFingerprintProgressPhase;
  readonly completedSamples: number;
  readonly totalSamples: number;
  readonly bytesRead: number;
  readonly totalBytesToRead: number;
}

export interface CreateLocalFileFingerprintOptions
  extends LocalFileFingerprintSamplingOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: LocalFileFingerprintProgress) => void;
  /** Supplying null explicitly simulates or enforces unavailable Web Crypto. */
  readonly digestAdapter?: ContentDigestAdapter | null;
}

export interface LocalFileFingerprintResult {
  readonly version: typeof LOCAL_FILE_FINGERPRINT_VERSION;
  readonly value: string;
  readonly sourceSizeBytes: number;
  readonly sampledBytes: number;
  readonly sampleCount: number;
  readonly sampleWindows: readonly LocalFileFingerprintSampleWindow[];
}

interface ResolvedSamplingOptions {
  readonly sampleCount: number;
  readonly chunkSizeBytes: number;
  readonly maxReadBytes: number;
}

/**
 * Plans deterministic, non-overlapping source reads. Files that fit inside the
 * read budget are hashed in full. Larger files use the beginning, evenly spaced
 * middle windows, and the final window.
 */
export function planLocalFileFingerprintSamples(
  sourceSizeBytes: number,
  options: LocalFileFingerprintSamplingOptions = {},
): LocalFileFingerprintPlan {
  if (!Number.isSafeInteger(sourceSizeBytes) || sourceSizeBytes < 0) {
    throw new LocalFileFingerprintError(
      "INVALID_SOURCE",
      "파일 크기를 안전하게 확인할 수 없어요.",
    );
  }

  const resolved = resolveSamplingOptions(options);

  if (sourceSizeBytes === 0) {
    return {
      sourceSizeBytes,
      sampledBytes: 0,
      windows: [],
    };
  }

  if (sourceSizeBytes <= resolved.maxReadBytes) {
    return {
      sourceSizeBytes,
      sampledBytes: sourceSizeBytes,
      windows: [{ offsetBytes: 0, lengthBytes: sourceSizeBytes }],
    };
  }

  const windowLengthBytes = Math.min(
    resolved.chunkSizeBytes,
    Math.floor(resolved.maxReadBytes / resolved.sampleCount),
  );
  const finalOffsetBytes = sourceSizeBytes - windowLengthBytes;
  const spacingBytes = finalOffsetBytes / (resolved.sampleCount - 1);
  const windows = Array.from({ length: resolved.sampleCount }, (_, index) => ({
    offsetBytes:
      index === resolved.sampleCount - 1
        ? finalOffsetBytes
        : Math.round(index * spacingBytes),
    lengthBytes: windowLengthBytes,
  }));

  return {
    sourceSizeBytes,
    sampledBytes: windowLengthBytes * windows.length,
    windows,
  };
}

/**
 * Creates a content-only sampled SHA-256 fingerprint. File name, MIME type,
 * lastModified, and filesystem path are intentionally outside the digest.
 */
export async function createLocalFileFingerprint(
  source: LocalFileFingerprintSource,
  options: CreateLocalFileFingerprintOptions = {},
): Promise<LocalFileFingerprintResult> {
  throwIfAborted(options.signal);

  const plan = planLocalFileFingerprintSamples(source.size, options);
  const adapter =
    options.digestAdapter === undefined
      ? (globalThis.crypto?.subtle ?? null)
      : options.digestAdapter;

  if (adapter === null) {
    throw new LocalFileFingerprintError(
      "CRYPTO_UNAVAILABLE",
      "이 브라우저에서는 안전한 SHA-256 파일 확인을 사용할 수 없어요.",
    );
  }

  const samples: Uint8Array<ArrayBuffer>[] = [];
  let bytesRead = 0;

  emitProgress(options.onProgress, {
    phase: "reading",
    completedSamples: 0,
    totalSamples: plan.windows.length,
    bytesRead,
    totalBytesToRead: plan.sampledBytes,
  });
  throwIfAborted(options.signal);

  for (const [index, window] of plan.windows.entries()) {
    throwIfAborted(options.signal);
    const sample = await readSample(source, window, options.signal);
    samples.push(sample);
    bytesRead += sample.byteLength;

    emitProgress(options.onProgress, {
      phase: "reading",
      completedSamples: index + 1,
      totalSamples: plan.windows.length,
      bytesRead,
      totalBytesToRead: plan.sampledBytes,
    });
    throwIfAborted(options.signal);
  }

  const digestInput = frameDigestInput(plan, samples);
  emitProgress(options.onProgress, {
    phase: "digesting",
    completedSamples: plan.windows.length,
    totalSamples: plan.windows.length,
    bytesRead,
    totalBytesToRead: plan.sampledBytes,
  });
  throwIfAborted(options.signal);

  let digest: ArrayBuffer;
  try {
    digest = await waitForPromiseWithAbort(
      adapter.digest("SHA-256", digestInput),
      options.signal,
    );
  } catch (cause) {
    if (cause instanceof LocalFileFingerprintError) {
      throw cause;
    }
    if (options.signal?.aborted === true || isAbortError(cause)) {
      throw abortedError(cause);
    }
    throw new LocalFileFingerprintError(
      "DIGEST_FAILED",
      "파일 지문을 계산하는 중 문제가 생겼어요.",
      { cause },
    );
  }

  throwIfAborted(options.signal);
  const value = `${LOCAL_FILE_FINGERPRINT_VERSION}:${bytesToHex(
    new Uint8Array(digest),
  )}`;

  emitProgress(options.onProgress, {
    phase: "completed",
    completedSamples: plan.windows.length,
    totalSamples: plan.windows.length,
    bytesRead,
    totalBytesToRead: plan.sampledBytes,
  });
  throwIfAborted(options.signal);

  return {
    version: LOCAL_FILE_FINGERPRINT_VERSION,
    value,
    sourceSizeBytes: plan.sourceSizeBytes,
    sampledBytes: plan.sampledBytes,
    sampleCount: plan.windows.length,
    sampleWindows: plan.windows,
  };
}

function resolveSamplingOptions(
  options: LocalFileFingerprintSamplingOptions,
): ResolvedSamplingOptions {
  const sampleCount =
    options.sampleCount ?? DEFAULT_LOCAL_FILE_FINGERPRINT_SAMPLE_COUNT;
  const chunkSizeBytes =
    options.chunkSizeBytes ?? DEFAULT_LOCAL_FILE_FINGERPRINT_CHUNK_SIZE_BYTES;
  const maxReadBytes =
    options.maxReadBytes ?? DEFAULT_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES;

  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < MIN_SAMPLE_COUNT ||
    sampleCount > MAX_SAMPLE_COUNT
  ) {
    throw new LocalFileFingerprintError(
      "INVALID_OPTIONS",
      `표본 개수는 ${MIN_SAMPLE_COUNT}~${MAX_SAMPLE_COUNT} 사이의 정수여야 해요.`,
    );
  }
  if (!Number.isSafeInteger(chunkSizeBytes) || chunkSizeBytes <= 0) {
    throw new LocalFileFingerprintError(
      "INVALID_OPTIONS",
      "표본 한 구간의 크기는 1바이트 이상의 정수여야 해요.",
    );
  }
  if (
    !Number.isSafeInteger(maxReadBytes) ||
    maxReadBytes < sampleCount ||
    maxReadBytes > ABSOLUTE_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES
  ) {
    throw new LocalFileFingerprintError(
      "INVALID_OPTIONS",
      `읽기 상한은 표본 개수 이상, ${ABSOLUTE_LOCAL_FILE_FINGERPRINT_MAX_READ_BYTES}바이트 이하여야 해요.`,
    );
  }

  return { sampleCount, chunkSizeBytes, maxReadBytes };
}

async function readSample(
  source: LocalFileFingerprintSource,
  window: LocalFileFingerprintSampleWindow,
  signal: AbortSignal | undefined,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const chunk = source.slice(
      window.offsetBytes,
      window.offsetBytes + window.lengthBytes,
    );
    if (chunk.size !== window.lengthBytes) {
      throw new Error("The source returned a sample with an unexpected size.");
    }

    const buffer = await waitForPromiseWithAbort(chunk.arrayBuffer(), signal);
    if (buffer.byteLength !== window.lengthBytes) {
      throw new Error("The source read returned an unexpected byte length.");
    }
    return new Uint8Array(buffer);
  } catch (cause) {
    if (cause instanceof LocalFileFingerprintError) {
      throw cause;
    }
    if (signal?.aborted === true || isAbortError(cause)) {
      throw abortedError(cause);
    }
    throw new LocalFileFingerprintError(
      "READ_FAILED",
      "선택한 파일의 확인용 구간을 읽지 못했어요.",
      { cause },
    );
  }
}

function frameDigestInput(
  plan: LocalFileFingerprintPlan,
  samples: readonly Uint8Array<ArrayBuffer>[],
): Uint8Array<ArrayBuffer> {
  const descriptorParts = [
    LOCAL_FILE_FINGERPRINT_VERSION,
    String(plan.sourceSizeBytes),
    String(plan.windows.length),
    ...plan.windows.flatMap((window) => [
      String(window.offsetBytes),
      String(window.lengthBytes),
    ]),
  ];
  const descriptor = new TextEncoder().encode(
    descriptorParts.map((part) => `${part.length}:${part}`).join("|"),
  );
  const totalSampleBytes = samples.reduce(
    (total, sample) => total + sample.byteLength,
    0,
  );
  const framed = new Uint8Array(4 + descriptor.byteLength + totalSampleBytes);
  new DataView(framed.buffer).setUint32(0, descriptor.byteLength, false);
  framed.set(descriptor, 4);

  let writeOffset = 4 + descriptor.byteLength;
  for (const sample of samples) {
    framed.set(sample, writeOffset);
    writeOffset += sample.byteLength;
  }
  return framed;
}

function emitProgress(
  callback: CreateLocalFileFingerprintOptions["onProgress"],
  progress: LocalFileFingerprintProgress,
): void {
  if (callback === undefined) {
    return;
  }
  try {
    callback(progress);
  } catch (cause) {
    throw new LocalFileFingerprintError(
      "PROGRESS_CALLBACK_FAILED",
      "파일 확인 진행 상황을 전달하는 중 문제가 생겼어요.",
      { cause },
    );
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw abortedError(signal.reason);
  }
}

function abortedError(cause?: unknown): LocalFileFingerprintError {
  return new LocalFileFingerprintError(
    "ABORTED",
    "사용자가 파일 확인을 취소했어요.",
    { cause },
  );
}

function isAbortError(cause: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    cause instanceof DOMException &&
    cause.name === "AbortError"
  );
}

function waitForPromiseWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal === undefined) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(abortedError(signal.reason));
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = (): void => {
      signal.removeEventListener("abort", handleAbort);
      reject(abortedError(signal.reason));
    };
    signal.addEventListener("abort", handleAbort, { once: true });

    void promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (cause: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        reject(
          cause instanceof Error
            ? cause
            : new Error("The pending fingerprint operation failed.", { cause }),
        );
      },
    );
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}
