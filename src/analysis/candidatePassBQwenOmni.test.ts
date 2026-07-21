import { describe, expect, it } from "vitest";
import {
  buildCandidatePassBQwenOmniRequestBody,
  extractCandidatePassBQwenOmniSseResponse,
} from "./candidatePassBQwenOmni";
import { extractCandidatePassBGeminiResponse } from "./candidatePassBGemini";

describe("candidatePassBQwenOmni", () => {
  it("builds one combined audio and multi-image streaming request", () => {
    const body = buildCandidatePassBQwenOmniRequestBody("AA==", 30_000, [
      { timestampMs: 5_000, mimeType: "image/jpeg", dataBase64: "AQ==" },
      { timestampMs: 15_000, mimeType: "image/jpeg", dataBase64: "Ag==" },
    ]);
    expect(body.model).toBe("qwen3.5-omni-flash");
    expect(body.stream).toBe(true);
    expect(body.modalities).toEqual(["text"]);
    expect(body.messages[0].content).toHaveLength(6);
    const serializedContent = JSON.stringify(body.messages[0].content);
    expect(serializedContent).toContain("input_audio");
    expect(serializedContent).toContain("5.0초");
    expect(serializedContent).toContain("15.0초");
    expect(
      body.messages[0].content.filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          item.type === "image_url",
      ),
    ).toHaveLength(2);
  });

  it("converts a valid SSE result into the hardened candidate envelope", () => {
    const analysis = {
      segments: [{ relativeStartMs: 0, relativeEndMs: 2_000, text: "제가 틀렸어요." }],
      eventSummaryKo: "음식 이름을 잘못 말한 뒤 화면을 다시 보고 자신의 실수를 깨닫는 장면이다.",
      reactionSummaryKo: "스트리머가 잠시 멈춘 뒤 당황하며 잘못을 인정한다.",
      whyGoodClipKo: "사건의 원인과 스트리머의 반응이 짧은 구간 안에서 완결된다.",
      uncertaintiesKo: ["대표 화면 사이의 움직임은 재생 확인이 필요하다."],
    };
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(analysis) }, finish_reason: null }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    const envelope = extractCandidatePassBQwenOmniSseResponse(sse, 30_000);
    expect(envelope).not.toBeNull();
    expect(extractCandidatePassBGeminiResponse(envelope, 30_000).ok).toBe(true);
  });
});
