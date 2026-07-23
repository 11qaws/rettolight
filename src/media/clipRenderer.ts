import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny";

export type ClipOutputKind = "mp4" | "webm";

export interface ClipTimeRange {
  readonly startMs: number;
  readonly endMs: number;
}

export interface ClipRenderRequest {
  readonly sourceFile: File;
  readonly range: ClipTimeRange;
  readonly candidateNumber: number;
  readonly outputKind?: ClipOutputKind;
  readonly title?: string | undefined;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ClipRenderProgress) => void;
}

export interface ClipRenderProgress {
  readonly ratio: number;
  readonly processedMs: number;
}

export interface ClipRenderResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly mimeType: string;
  readonly durationMs: number;
}

export type ClipRenderFailureCode =
  | "ABORTED"
  | "INVALID_RANGE"
  | "UNSUPPORTED_SOURCE"
  | "NO_OUTPUT";

export class ClipRenderError extends Error {
  readonly code: ClipRenderFailureCode;

  constructor(code: ClipRenderFailureCode, message: string) {
    super(message);
    this.name = "ClipRenderError";
    this.code = code;
  }
}

export function inferClipOutputKind(file: Pick<File, "name" | "type">): ClipOutputKind {
  const normalizedType = file.type.toLowerCase();
  if (normalizedType === "video/webm" || /\.webm$/iu.test(file.name)) {
    return "webm";
  }
  return "mp4";
}

export function validateClipTimeRange(range: ClipTimeRange): void {
  if (
    !Number.isSafeInteger(range.startMs) ||
    !Number.isSafeInteger(range.endMs) ||
    range.startMs < 0 ||
    range.endMs <= range.startMs
  ) {
    throw new ClipRenderError(
      "INVALID_RANGE",
      "Clip range must have a non-negative start before its end.",
    );
  }
}

function clipTimePart(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/gu;
const SLUG_MAX_LENGTH = 40;

/**
 * A title turned into filesystem-safe text for a clip's base filename.
 * Returns "" for a title that has no safe characters left (an emoji-only
 * title, for example) so the caller can fall back to the timecode form.
 */
function slugifyTitle(title: string): string {
  return title
    .normalize("NFC")
    .replace(UNSAFE_FILENAME_CHARS, "")
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/**
 * The shared filename stem (no extension) for a candidate's clip, subtitle
 * track, and thumbnail — keeping the three files grouped under the same
 * base name in a downloads folder. Falls back to the original timecode form
 * when no title is given, so filenames stay stable for callers that predate
 * H-3 titling.
 */
export function buildClipBaseName(
  candidateNumber: number,
  range: ClipTimeRange,
  title?: string,
): string {
  validateClipTimeRange(range);
  if (!Number.isSafeInteger(candidateNumber) || candidateNumber <= 0) {
    throw new RangeError("Candidate number must be a positive safe integer.");
  }
  const slug = title !== undefined ? slugifyTitle(title) : "";
  const stem =
    slug.length > 0 ? slug : `${clipTimePart(range.startMs)}-${clipTimePart(range.endMs)}`;
  return `exclipper-${String(candidateNumber).padStart(2, "0")}-${stem}`;
}

export function buildClipFileName(
  candidateNumber: number,
  range: ClipTimeRange,
  outputKind: ClipOutputKind,
  title?: string,
): string {
  return `${buildClipBaseName(candidateNumber, range, title)}.${outputKind}`;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new ClipRenderError("ABORTED", "Clip rendering was canceled.");
  }
}

/**
 * Renders one approved candidate range in the browser. Mediabunny reads only
 * the requested source ranges where the container allows it and trims the
 * output to a fresh timestamp origin.
 */
export async function renderHighlightClip(
  request: ClipRenderRequest,
): Promise<ClipRenderResult> {
  validateClipTimeRange(request.range);
  if (typeof File === "undefined" || !(request.sourceFile instanceof File)) {
    throw new ClipRenderError("UNSUPPORTED_SOURCE", "A source video file is required.");
  }
  throwIfAborted(request.signal);

  const outputKind = request.outputKind ?? inferClipOutputKind(request.sourceFile);
  const format =
    outputKind === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat();
  const target = new BufferTarget();
  const input = new Input({
    source: new BlobSource(request.sourceFile),
    formats: ALL_FORMATS,
  });
  const output = new Output({ format, target });
  let conversion: Conversion | null = null;
  const onAbort = (): void => {
    void conversion?.cancel();
  };
  request.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim: {
        start: request.range.startMs / 1_000,
        end: request.range.endMs / 1_000,
      },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      throw new ClipRenderError(
        "UNSUPPORTED_SOURCE",
        "This source video cannot be rendered in the current browser.",
      );
    }
    conversion.onProgress = (ratio, processedTime) => {
      request.onProgress?.({
        ratio: Math.max(0, Math.min(1, ratio)),
        processedMs: Math.max(0, Math.round(processedTime * 1_000)),
      });
    };
    throwIfAborted(request.signal);
    await conversion.execute();
    throwIfAborted(request.signal);
    const buffer = target.buffer;
    if (buffer === null || buffer.byteLength === 0) {
      throw new ClipRenderError("NO_OUTPUT", "The rendered clip was empty.");
    }
    const mimeType = format.mimeType;
    return {
      blob: new Blob([buffer], { type: mimeType }),
      fileName: buildClipFileName(request.candidateNumber, request.range, outputKind, request.title),
      mimeType,
      durationMs: request.range.endMs - request.range.startMs,
    };
  } catch (error) {
    if (request.signal?.aborted === true) {
      throw new ClipRenderError("ABORTED", "Clip rendering was canceled.");
    }
    if (error instanceof ClipRenderError) {
      throw error;
    }
    throw new ClipRenderError(
      "UNSUPPORTED_SOURCE",
      "This source video could not be rendered in the current browser.",
    );
  } finally {
    request.signal?.removeEventListener("abort", onAbort);
    input.dispose();
  }
}
