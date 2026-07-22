import { describe, expect, it } from "vitest";
import {
  BROADCAST_TRANSCRIPT_QWEN_MODEL_ID,
  buildBroadcastTranscriptQwenRequestBody,
  extractBroadcastTranscriptQwenResponse,
  parseBroadcastTranscriptQwenProxyRequest,
} from "./broadcastTranscriptQwen";

describe("broadcastTranscriptQwen", () => {
  it("builds the documented Korean ASR request without accepting provider controls", () => {
    expect(buildBroadcastTranscriptQwenRequestBody("UklGRg==")).toEqual({
      model: BROADCAST_TRANSCRIPT_QWEN_MODEL_ID,
      input: {
        messages: [
          { role: "system", content: [{ text: "" }] },
          {
            role: "user",
            content: [{ audio: "data:audio/wav;base64,UklGRg==" }],
          },
        ],
      },
      parameters: {
        asr_options: { language: "ko", enable_itn: false },
      },
    });
  });

  it("validates the exact browser-to-proxy envelope", () => {
    const valid = { audioBase64: "UklGRg==", sourceStartMs: 600_000, durationMs: 90_000 };
    expect(parseBroadcastTranscriptQwenProxyRequest(valid)).toEqual(valid);
    expect(parseBroadcastTranscriptQwenProxyRequest({ ...valid, model: "other" })).toBeNull();
    expect(parseBroadcastTranscriptQwenProxyRequest({ ...valid, durationMs: 90_001 })).toBeNull();
  });

  it("maps a validated provider response back onto the source timeline", () => {
    const result = extractBroadcastTranscriptQwenResponse(
      {
        output: { choices: [
          {
            finish_reason: "stop",
            message: {
              content: [{ text: "  두바이 초콜릿을 먹고 예상 밖의 맛에 놀란다.  " }],
              annotations: [{ type: "audio_info", language: "ko", emotion: "surprised" }],
            },
          },
        ] },
        usage: { seconds: 32 },
      },
      { sourceStartMs: 1_700_000, durationMs: 32_000 },
    );
    expect(result).toMatchObject({
      sourceStartMs: 1_700_000,
      sourceEndMs: 1_732_000,
      textKo: "두바이 초콜릿을 먹고 예상 밖의 맛에 놀란다.",
      detectedLanguage: "ko",
      emotion: "surprised",
      billedSeconds: 32,
    });
  });

  it("rejects incomplete and overlong provider output", () => {
    expect(extractBroadcastTranscriptQwenResponse({ output: { choices: [] } }, { sourceStartMs: 0, durationMs: 1_000 })).toBeNull();
    expect(
      extractBroadcastTranscriptQwenResponse(
        { output: { choices: [{ finish_reason: "length", message: { content: [{ text: "partial" }] } }] } },
        { sourceStartMs: 0, durationMs: 1_000 },
      ),
    ).toBeNull();
  });
});
