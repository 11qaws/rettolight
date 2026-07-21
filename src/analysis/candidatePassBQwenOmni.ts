import {
  MAX_CANDIDATE_PASS_B_RESPONSE_BYTES,
  MAX_CANDIDATE_PASS_B_IDENTIFIED_PARTICIPANTS,
  MAX_CANDIDATE_PASS_B_PARTICIPANT_EVIDENCE_LENGTH,
  MAX_CANDIDATE_PASS_B_PARTICIPANT_NAME_LENGTH,
  buildCandidatePassBPrompt,
  extractCandidatePassBGeminiResponse,
} from "./candidatePassBGemini";
import {
  CANDIDATE_PASS_B_QWEN_MODEL_ID,
  MAX_CANDIDATE_PASS_B_TARGET_DURATION_MS,
  MAX_CANDIDATE_PASS_B_VIDEO_FRAME_BASE64_LENGTH,
  MAX_CANDIDATE_PASS_B_VIDEO_FRAMES,
  type CandidatePassBVideoFrame,
} from "./candidatePassBWorkerProtocol";

const MAX_BASE64_WAV_LENGTH = 8 * 1024 * 1024;

export interface CandidatePassBQwenOmniRequestBody {
  readonly model: typeof CANDIDATE_PASS_B_QWEN_MODEL_ID;
  readonly messages: readonly [{
    readonly role: "user";
    readonly content: readonly unknown[];
  }];
  readonly stream: true;
  readonly stream_options: { readonly include_usage: true };
  readonly modalities: readonly ["text"];
}

export interface CandidatePassBQwenOmniDiagnostics {
  readonly sawStop: boolean;
  readonly textLength: number;
  readonly contentWasString: boolean;
  readonly jsonObject: boolean;
  readonly keys: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedKorean(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length === 0 || !/\p{Script=Hangul}/u.test(normalized)) return null;
  return Array.from(normalized).slice(0, maximumLength).join("").trim();
}

function normalizedName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length === 0) return null;
  const bounded = Array.from(normalized)
    .slice(0, MAX_CANDIDATE_PASS_B_PARTICIPANT_NAME_LENGTH)
    .join("")
    .trim();
  return bounded.length > 0 ? bounded : null;
}

function normalizedQwenJson(text: string, candidateDurationMs: number): string | null {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  let value: unknown;
  try {
    value = JSON.parse(unfenced);
  } catch {
    return null;
  }
  if (!isRecord(value) || !Array.isArray(value.segments)) return null;
  const eventSummaryKo = normalizedKorean(value.eventSummaryKo, 600);
  const reactionSummaryKo = normalizedKorean(value.reactionSummaryKo, 600);
  const whyGoodClipKo = normalizedKorean(value.whyGoodClipKo, 600);
  if (eventSummaryKo === null || reactionSummaryKo === null || whyGoodClipKo === null) {
    return null;
  }
  const segments: Array<{
    readonly relativeStartMs: number;
    readonly relativeEndMs: number;
    readonly text: string;
  }> = [];
  for (const raw of value.segments.slice(0, 128)) {
    if (!isRecord(raw)) continue;
    const start = typeof raw.relativeStartMs === "number"
      ? Math.round(raw.relativeStartMs)
      : null;
    const end = typeof raw.relativeEndMs === "number"
      ? Math.round(raw.relativeEndMs)
      : null;
    const textValue = raw.text === "[불명]"
      ? "[불명]"
      : normalizedKorean(raw.text, 240);
    if (start === null || end === null || textValue === null) continue;
    const relativeStartMs = Math.max(0, Math.min(candidateDurationMs - 1, start));
    const relativeEndMs = Math.max(
      relativeStartMs + 1,
      Math.min(candidateDurationMs, end),
    );
    segments.push({ relativeStartMs, relativeEndMs, text: textValue });
  }
  segments.sort(
    (left, right) => left.relativeStartMs - right.relativeStartMs ||
      left.relativeEndMs - right.relativeEndMs,
  );
  const nonOverlapping = segments.filter(
    (segment, index) => index === 0 || segment.relativeStartMs >= segments[index - 1]!.relativeEndMs,
  );
  const uncertaintiesKo: string[] = [];
  if (Array.isArray(value.uncertaintiesKo)) {
    for (const raw of value.uncertaintiesKo.slice(0, 6)) {
      const normalized = normalizedKorean(raw, 300);
      if (normalized !== null && !uncertaintiesKo.includes(normalized)) {
        uncertaintiesKo.push(normalized);
      }
    }
  }
  if (uncertaintiesKo.length === 0) {
    uncertaintiesKo.push("대표 화면 사이의 움직임은 원본 재생으로 확인해야 합니다.");
  }
  const identifiedParticipants: Array<{
    readonly displayName: string;
    readonly role: "streamer" | "guest" | "unknown";
    readonly evidenceBasis:
      | "on-screen-name"
      | "spoken-name"
      | "provided-cast-reference";
    readonly evidenceKo: string;
    readonly confidence: number;
    readonly relativeTimestampMs: number;
  }> = [];
  const seenParticipantNames = new Set<string>();
  if (Array.isArray(value.identifiedParticipants)) {
    for (const raw of value.identifiedParticipants.slice(
      0,
      MAX_CANDIDATE_PASS_B_IDENTIFIED_PARTICIPANTS,
    )) {
      if (!isRecord(raw)) continue;
      const displayName = normalizedName(raw.displayName);
      const evidenceKo = normalizedKorean(
        raw.evidenceKo,
        MAX_CANDIDATE_PASS_B_PARTICIPANT_EVIDENCE_LENGTH,
      );
      const role = ["streamer", "guest", "unknown"].includes(raw.role as string)
        ? (raw.role as "streamer" | "guest" | "unknown")
        : null;
      const evidenceBasis = [
        "on-screen-name",
        "spoken-name",
        "provided-cast-reference",
      ].includes(raw.evidenceBasis as string)
        ? (raw.evidenceBasis as
            | "on-screen-name"
            | "spoken-name"
            | "provided-cast-reference")
        : null;
      const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : null;
      const timestamp = typeof raw.relativeTimestampMs === "number" && Number.isFinite(raw.relativeTimestampMs)
        ? Math.round(Math.max(0, Math.min(candidateDurationMs, raw.relativeTimestampMs)))
        : null;
      const nameKey = displayName?.toLocaleLowerCase("ko-KR") ?? "";
      if (
        displayName === null ||
        evidenceKo === null ||
        role === null ||
        evidenceBasis === null ||
        confidence === null ||
        timestamp === null ||
        seenParticipantNames.has(nameKey)
      ) {
        continue;
      }
      seenParticipantNames.add(nameKey);
      identifiedParticipants.push({
        displayName,
        role,
        evidenceBasis,
        evidenceKo,
        confidence,
        relativeTimestampMs: timestamp,
      });
    }
  }
  return JSON.stringify({
    segments: nonOverlapping,
    eventSummaryKo,
    reactionSummaryKo,
    whyGoodClipKo,
    uncertaintiesKo,
    identifiedParticipants,
  });
}

function validFrames(
  frames: readonly CandidatePassBVideoFrame[],
): readonly CandidatePassBVideoFrame[] {
  const normalized: CandidatePassBVideoFrame[] = [];
  for (const frame of frames) {
    if (
      normalized.length >= MAX_CANDIDATE_PASS_B_VIDEO_FRAMES ||
      !Number.isSafeInteger(frame.timestampMs) ||
      frame.timestampMs < 0 ||
      frame.mimeType !== "image/jpeg" ||
      typeof frame.dataBase64 !== "string" ||
      frame.dataBase64.length === 0 ||
      frame.dataBase64.length > MAX_CANDIDATE_PASS_B_VIDEO_FRAME_BASE64_LENGTH
    ) {
      continue;
    }
    normalized.push(frame);
  }
  // Qwen Omni's documented image-list contract requires at least two images.
  return normalized.length >= 2 ? normalized : [];
}

export function buildCandidatePassBQwenOmniRequestBody(
  audioBase64: string,
  candidateDurationMs: number,
  videoFrames: readonly CandidatePassBVideoFrame[] = [],
): CandidatePassBQwenOmniRequestBody {
  if (
    typeof audioBase64 !== "string" ||
    audioBase64.length === 0 ||
    audioBase64.length > MAX_BASE64_WAV_LENGTH ||
    !Number.isSafeInteger(candidateDurationMs) ||
    candidateDurationMs <= 0 ||
    candidateDurationMs > MAX_CANDIDATE_PASS_B_TARGET_DURATION_MS
  ) {
    throw new RangeError("Invalid Qwen Omni candidate input.");
  }
  const frames = validFrames(videoFrames);
  const qwenGroundingRules = frames.length === 0
    ? "\n대표 화면이 제공되지 않았습니다. 화면 내용, 비명의 원인, 표정, 몸짓, 게임 상황을 추측하지 말고 시각 정보가 없다고 uncertaintiesKo에 적으세요."
    : "\n대표 화면에서 실제로 확인되는 것만 서술하세요. 작아서 선명하게 읽히지 않는 글자는 인용하지 말고, 아바타 이미지의 프레임별 차이만으로 몸짓·행동·감정을 단정하지 마세요. 프레임 사이의 움직임과 인과관계는 보이지 않으므로 대사와 화면 양쪽에서 확인되지 않으면 uncertaintiesKo에 남기세요.";
  const responseShape = `\n\n다음 JSON 형식만 출력하세요:\n{"segments":[{"relativeStartMs":0,"relativeEndMs":1000,"text":"실제 한국어 발화"}],"eventSummaryKo":"화면 장면·사건·반응 200~300자","reactionSummaryKo":"관찰한 반응 과정","whyGoodClipKo":"클립 가치 또는 제외 이유","uncertaintiesKo":[],"identifiedParticipants":[{"displayName":"화면이나 호명으로 확인한 이름","role":"streamer","evidenceBasis":"on-screen-name","evidenceKo":"화면 자막에 이름이 표시됨","confidence":0.9,"relativeTimestampMs":5000}]}`;
  return {
    model: CANDIDATE_PASS_B_QWEN_MODEL_ID,
    messages: [{
      role: "user",
      content: [
        {
          type: "input_audio",
          input_audio: {
            data: `data:;base64,${audioBase64}`,
            format: "wav",
          },
        },
        ...frames.flatMap((frame, index) => [
          {
            type: "text",
            text: `[대표 화면 ${index + 1} · 후보 시작 후 ${(frame.timestampMs / 1_000).toFixed(1)}초]`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${frame.mimeType};base64,${frame.dataBase64}`,
            },
          },
        ]),
        {
          type: "text",
          text: `${buildCandidatePassBPrompt(candidateDurationMs, frames.length)}${qwenGroundingRules}\n한국어 설명에는 불필요한 중국어·일본어 문자를 섞지 말고 자연스러운 한국어만 사용하세요.${responseShape}`,
        },
      ],
    }],
    stream: true,
    stream_options: { include_usage: true },
    modalities: ["text"],
  };
}

/**
 * Converts Qwen Omni's mandatory SSE stream into the already-hardened Gemini
 * response envelope consumed by the browser worker. No provider text bypasses
 * the existing Korean/timestamp/schema validation.
 */
export function extractCandidatePassBQwenOmniSseResponse(
  value: string,
  candidateDurationMs: number,
): Record<string, unknown> | null {
  if (typeof value !== "string" || value.length === 0) return null;
  let text = "";
  let sawStop = false;
  for (const line of value.split(/\r?\n/gu)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") continue;
    let chunk: unknown;
    try {
      chunk = JSON.parse(data);
    } catch {
      return null;
    }
    if (!isRecord(chunk) || !Array.isArray(chunk.choices)) return null;
    if (chunk.choices.length === 0) continue;
    if (chunk.choices.length !== 1 || !isRecord(chunk.choices[0])) return null;
    const choice = chunk.choices[0];
    if (choice.finish_reason === "stop") sawStop = true;
    if (!isRecord(choice.delta)) return null;
    const content = choice.delta.content;
    if (content !== undefined && typeof content !== "string") return null;
    if (typeof content === "string") text += content;
    if (new TextEncoder().encode(text).byteLength > MAX_CANDIDATE_PASS_B_RESPONSE_BYTES) {
      return null;
    }
  }
  if (!sawStop) return null;
  const normalized = normalizedQwenJson(text, candidateDurationMs);
  if (normalized === null) return null;
  const envelope = {
    candidates: [{
      finishReason: "STOP",
      content: { parts: [{ text: normalized }] },
    }],
  };
  return extractCandidatePassBGeminiResponse(envelope, candidateDurationMs).ok
    ? envelope
    : null;
}

export function inspectCandidatePassBQwenOmniSseResponse(
  value: string,
): CandidatePassBQwenOmniDiagnostics {
  let text = "";
  let sawStop = false;
  let contentWasString = true;
  for (const line of typeof value === "string" ? value.split(/\r?\n/gu) : []) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") continue;
    try {
      const chunk = JSON.parse(data) as unknown;
      if (!isRecord(chunk) || !Array.isArray(chunk.choices)) continue;
      for (const rawChoice of chunk.choices) {
        if (!isRecord(rawChoice)) continue;
        if (rawChoice.finish_reason === "stop") sawStop = true;
        if (!isRecord(rawChoice.delta)) continue;
        const content = rawChoice.delta.content;
        if (content !== undefined && typeof content !== "string") {
          contentWasString = false;
        } else if (typeof content === "string") {
          text += content;
        }
      }
    } catch {
      contentWasString = false;
    }
  }
  let jsonObject = false;
  let keys: readonly string[] = [];
  try {
    const parsed = JSON.parse(
      text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, ""),
    ) as unknown;
    if (isRecord(parsed)) {
      jsonObject = true;
      keys = Object.keys(parsed).sort();
    }
  } catch {
    // Shape-only diagnostics intentionally omit generated text.
  }
  return { sawStop, textLength: text.length, contentWasString, jsonObject, keys };
}
