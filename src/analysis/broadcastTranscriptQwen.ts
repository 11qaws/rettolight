export const BROADCAST_TRANSCRIPT_QWEN_SCHEMA_VERSION = "1.0.0" as const;
export const BROADCAST_TRANSCRIPT_QWEN_MODEL_ID = "qwen3-asr-flash" as const;
export const BROADCAST_TRANSCRIPT_QWEN_MODEL_REVISION =
  "qwen3-asr-flash-api-reviewed-2026-07-22" as const;
export const MAX_BROADCAST_TRANSCRIPT_QWEN_DURATION_MS = 210_000;
export const MAX_BROADCAST_TRANSCRIPT_QWEN_BASE64_LENGTH = 9_500_000;
export const MAX_BROADCAST_TRANSCRIPT_QWEN_TEXT_LENGTH = 20_000;
export const MAX_BROADCAST_TRANSCRIPT_QWEN_RESPONSE_BYTES = 128 * 1024;

export interface BroadcastTranscriptQwenProxyRequest {
  readonly audioBase64: string;
  readonly sourceStartMs: number;
  readonly durationMs: number;
}

export interface BroadcastTranscriptQwenResult {
  readonly schemaVersion: typeof BROADCAST_TRANSCRIPT_QWEN_SCHEMA_VERSION;
  readonly modelId: typeof BROADCAST_TRANSCRIPT_QWEN_MODEL_ID;
  readonly sourceStartMs: number;
  readonly sourceEndMs: number;
  readonly textKo: string;
  readonly detectedLanguage: string | null;
  readonly emotion: string | null;
  readonly billedSeconds: number | null;
}

interface QwenAsrAnnotation {
  readonly language: string | null;
  readonly emotion: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizedOptionalLabel(value: unknown): string | null {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 40 ? normalized : null;
}

function normalizedTranscript(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint === 127 ||
      (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13)
    ) {
      return null;
    }
  }
  const normalized = value.replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ").trim();
  return normalized.length > 0 && normalized.length <= MAX_BROADCAST_TRANSCRIPT_QWEN_TEXT_LENGTH
    ? normalized
    : null;
}

function readAnnotation(value: unknown): QwenAsrAnnotation {
  if (!Array.isArray(value)) return { language: null, emotion: null };
  for (const entry of value) {
    if (!isRecord(entry) || entry.type !== "audio_info") continue;
    return {
      language: normalizedOptionalLabel(entry.language),
      emotion: normalizedOptionalLabel(entry.emotion),
    };
  }
  return { language: null, emotion: null };
}

function readOpenAiCompatibleResponse(value: unknown): {
  readonly text: string;
  readonly annotation: QwenAsrAnnotation;
  readonly billedSeconds: number | null;
} | null {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length !== 1) return null;
  const choices: readonly unknown[] = value.choices;
  const choice = choices[0];
  if (!isRecord(choice) || choice.finish_reason !== "stop" || !isRecord(choice.message)) return null;
  const text = normalizedTranscript(choice.message.content);
  if (text === null) return null;
  const usage = isRecord(value.usage) ? value.usage : null;
  const seconds = usage?.seconds;
  return {
    text,
    annotation: readAnnotation(choice.message.annotations),
    billedSeconds:
      typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
        ? seconds
        : null,
  };
}

/** Builds the fixed server-side request for Alibaba's OpenAI-compatible API. */
export function buildBroadcastTranscriptQwenRequestBody(audioBase64: string): unknown {
  if (
    typeof audioBase64 !== "string" ||
    audioBase64.length === 0 ||
    audioBase64.length > MAX_BROADCAST_TRANSCRIPT_QWEN_BASE64_LENGTH ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(audioBase64)
  ) {
    throw new RangeError("Qwen ASR audio must be a bounded Base64 WAV payload.");
  }
  return {
    model: BROADCAST_TRANSCRIPT_QWEN_MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: `data:audio/wav;base64,${audioBase64}` },
          },
        ],
      },
    ],
    stream: false,
    asr_options: {
      language: "ko",
      enable_itn: false,
    },
  };
}

export function parseBroadcastTranscriptQwenProxyRequest(
  value: unknown,
): BroadcastTranscriptQwenProxyRequest | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["audioBase64", "sourceStartMs", "durationMs"]) ||
    typeof value.audioBase64 !== "string" ||
    value.audioBase64.length === 0 ||
    value.audioBase64.length > MAX_BROADCAST_TRANSCRIPT_QWEN_BASE64_LENGTH ||
    !Number.isSafeInteger(value.sourceStartMs) ||
    (value.sourceStartMs as number) < 0 ||
    !Number.isSafeInteger(value.durationMs) ||
    (value.durationMs as number) <= 0 ||
    (value.durationMs as number) > MAX_BROADCAST_TRANSCRIPT_QWEN_DURATION_MS
  ) {
    return null;
  }
  return {
    audioBase64: value.audioBase64,
    sourceStartMs: value.sourceStartMs as number,
    durationMs: value.durationMs as number,
  };
}

export function extractBroadcastTranscriptQwenResponse(
  value: unknown,
  request: Pick<BroadcastTranscriptQwenProxyRequest, "sourceStartMs" | "durationMs">,
): BroadcastTranscriptQwenResult | null {
  const parsed = readOpenAiCompatibleResponse(value);
  if (parsed === null) return null;
  return {
    schemaVersion: BROADCAST_TRANSCRIPT_QWEN_SCHEMA_VERSION,
    modelId: BROADCAST_TRANSCRIPT_QWEN_MODEL_ID,
    sourceStartMs: request.sourceStartMs,
    sourceEndMs: request.sourceStartMs + request.durationMs,
    textKo: parsed.text,
    detectedLanguage: parsed.annotation.language,
    emotion: parsed.annotation.emotion,
    billedSeconds: parsed.billedSeconds,
  };
}
