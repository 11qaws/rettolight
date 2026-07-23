import { describe, expect, it } from "vitest";
import { buildBroadcastSummaryCitationPresentation } from "./broadcastSummaryCitations";

describe("broadcast summary citations", () => {
  it("emphasizes matching summary prose and links final candidate ids", () => {
    const result = buildBroadcastSummaryCitationPresentation(
      "음식 이름 맞히기 퀴즈를 진행했다. 이후 근황 토크로 넘어갔다.",
      [{
        candidateId: "candidate-7",
        candidateNumber: 1,
        situationKo: "음식 이름을 틀린 뒤 당황하고 정답을 확인했다.",
        topicContextKo: "음식 이름 맞히기 퀴즈",
      }],
    );

    expect(result.parts[0]).toMatchObject({
      emphasized: true,
      candidateIds: ["candidate-7"],
    });
    expect(result.citedCandidateIds).toEqual(["candidate-7"]);
  });

  it("appends a grounded situation when the overview omitted that event", () => {
    const result = buildBroadcastSummaryCitationPresentation(
      "방송에서 여러 주제로 대화를 나눴다.",
      [{
        candidateId: "candidate-9",
        candidateNumber: 1,
        situationKo: "결제 실수를 알아차리고 정확히 사과했다.",
        topicContextKo: "구독 결제 해명",
      }],
    );

    expect(result.parts.at(-1)).toEqual({
      text: "결제 실수를 알아차리고 정확히 사과했다.",
      candidateIds: ["candidate-9"],
      emphasized: true,
    });
  });
});
