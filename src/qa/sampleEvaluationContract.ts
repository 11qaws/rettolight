export const SAMPLE_EVALUATION_CONTRACT_VERSION = "1.0.0" as const;

export type SampleGroundTruthMode =
  | "named-positive-regression"
  | "negative-abstention"
  | "context-target";

export interface NamedPositiveMoment {
  readonly labelKo: string;
  readonly approximatePeakMs: number;
  readonly toleranceMs: number;
}

export interface SampleEvaluationContract {
  readonly sourceId: string;
  readonly mode: SampleGroundTruthMode;
  readonly knownPositiveMoments: readonly NamedPositiveMoment[];
  readonly forbiddenAutomaticCategories: readonly string[];
  readonly acceptanceKo: readonly string[];
}

/**
 * Human-reviewed sample truth. These contracts describe expected behavior and
 * must not be converted into source-specific detector time rules.
 */
export const SAMPLE_EVALUATION_CONTRACTS = {
  foodTalk: {
    sourceId: "KzAW3yow80Q",
    mode: "named-positive-regression",
    knownPositiveMoments: [
      { labelKo: "칼국수", approximatePeakMs: 21 * 60_000 + 2_000, toleranceMs: 45_000 },
      { labelKo: "껍데기", approximatePeakMs: 22 * 60_000 + 45_000, toleranceMs: 45_000 },
      { labelKo: "두바이초콜릿", approximatePeakMs: 28 * 60_000 + 25_000, toleranceMs: 45_000 },
    ],
    forbiddenAutomaticCategories: ["music-or-song", "opening-ending-or-break"],
    acceptanceKo: [
      "세 음식 토크 사건을 모두 정밀 분석 대상으로 보존한다.",
      "초반 오프닝·대기 음악은 고유한 스트리머 발화 사건이 없으면 제외한다.",
    ],
  },
  minecraftRelay: {
    sourceId: "vadCuMEo5PQ",
    mode: "negative-abstention",
    knownPositiveMoments: [],
    forbiddenAutomaticCategories: [
      "reaction-without-context",
      "no-distinct-event",
      "music-or-song",
    ],
    acceptanceKo: [
      "단편적이고 제한적인 반응만 확인되면 최종 클립을 0개로 반환한다.",
      "후보 예산을 채우기 위해 평범한 진행을 선택하지 않는다.",
    ],
  },
  accidentalSubscription: {
    sourceId: "EZfCGS5ms_Q",
    mode: "context-target",
    knownPositiveMoments: [],
    forbiddenAutomaticCategories: ["reaction-without-context", "no-distinct-event"],
    acceptanceKo: [
      "실수로 구독을 연 사실을 정확히 인정하고 사과하는 발화 구간을 찾아야 한다.",
      "사과를 확인하지 못한 주변 반응은 높은 음량만으로 선택하지 않는다.",
      "정확한 사람 검토 시각이 기록되기 전에는 임의의 타임스탬프를 정답으로 만들지 않는다.",
    ],
  },
} as const satisfies Readonly<Record<string, SampleEvaluationContract>>;
