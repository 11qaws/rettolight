/**
 * Conservative client-side estimate for the active Qwen3.5 Omni Flash payload
 * in the Singapore deployment. Alibaba documents 7 tokens per input-audio
 * second and one image token per 32x32 pixels. The 720-token frame allowance
 * covers the app's 640px-wide portrait worst case, while normal 16:9 frames use
 * considerably fewer tokens. This remains a planning estimate, not an invoice.
 */
export const QWEN_PASS_B_AUDIO_TOKENS_PER_SECOND = 7;
export const QWEN_PASS_B_IMAGE_TOKENS_PER_FRAME = 720;
export const QWEN_PASS_B_PROMPT_TOKENS_PER_CANDIDATE = 900;
export const QWEN_PASS_B_OUTPUT_TOKENS_PER_CANDIDATE = 700;
export const QWEN_PASS_B_TEXT_IMAGE_INPUT_PRICE_PER_MILLION_USD = 0.4;
export const QWEN_PASS_B_AUDIO_INPUT_PRICE_PER_MILLION_USD = 3;
export const QWEN_PASS_B_TEXT_OUTPUT_PRICE_PER_MILLION_USD = 2.2;

export interface CandidatePassBCostEstimate {
  readonly candidateCount: number;
  readonly audioDurationMs: number;
  readonly frameCount: number;
  readonly inputTokens: number;
  readonly audioInputTokens: number;
  readonly textImageInputTokens: number;
  readonly outputTokens: number;
  /** Weighted effective input price retained for compact UI display. */
  readonly inputPricePerMillionUsd: number;
  readonly audioInputPricePerMillionUsd: number;
  readonly textImageInputPricePerMillionUsd: number;
  readonly outputPricePerMillionUsd: number;
  readonly inputCostUsd: number;
  readonly outputCostUsd: number;
  readonly totalCostUsd: number;
}

export function estimateCandidatePassBCost(
  candidateCount: number,
  candidateDurationMs: number,
  frameCount = 4,
): CandidatePassBCostEstimate {
  const normalizedCandidateCount = clampInteger(candidateCount, 0, 12);
  const normalizedDurationMs = Math.min(
    60_000,
    Math.max(0, Math.round(candidateDurationMs)),
  );
  const normalizedFrameCount = clampInteger(frameCount, 0, 4);
  const audioInputTokens = Math.round(
    normalizedCandidateCount *
      (normalizedDurationMs / 1_000) * QWEN_PASS_B_AUDIO_TOKENS_PER_SECOND,
  );
  const textImageInputTokens = Math.round(
    normalizedCandidateCount *
      (normalizedFrameCount * QWEN_PASS_B_IMAGE_TOKENS_PER_FRAME +
        QWEN_PASS_B_PROMPT_TOKENS_PER_CANDIDATE),
  );
  const inputTokens = audioInputTokens + textImageInputTokens;
  const outputTokens =
    normalizedCandidateCount * QWEN_PASS_B_OUTPUT_TOKENS_PER_CANDIDATE;
  const inputCostUsd =
    (audioInputTokens / 1_000_000) *
      QWEN_PASS_B_AUDIO_INPUT_PRICE_PER_MILLION_USD +
    (textImageInputTokens / 1_000_000) *
      QWEN_PASS_B_TEXT_IMAGE_INPUT_PRICE_PER_MILLION_USD;
  const inputPricePerMillionUsd = inputTokens === 0
    ? 0
    : (inputCostUsd * 1_000_000) / inputTokens;
  const outputPricePerMillionUsd = QWEN_PASS_B_TEXT_OUTPUT_PRICE_PER_MILLION_USD;
  const outputCostUsd = (outputTokens / 1_000_000) * outputPricePerMillionUsd;
  return {
    candidateCount: normalizedCandidateCount,
    audioDurationMs: normalizedDurationMs,
    frameCount: normalizedFrameCount,
    inputTokens,
    audioInputTokens,
    textImageInputTokens,
    outputTokens,
    inputPricePerMillionUsd,
    audioInputPricePerMillionUsd:
      QWEN_PASS_B_AUDIO_INPUT_PRICE_PER_MILLION_USD,
    textImageInputPricePerMillionUsd:
      QWEN_PASS_B_TEXT_IMAGE_INPUT_PRICE_PER_MILLION_USD,
    outputPricePerMillionUsd,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function formatEstimatedUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "$0.00";
  }
  if (value < 0.01) {
    return "<$0.01";
  }
  return `$${value.toFixed(2)}`;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
