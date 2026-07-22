import type {
  CandidatePassBParticipantRole,
} from "./candidatePassBWorkerProtocol";

export const CANDIDATE_PASS_B_CAST_ROSTER_VERSION = "1.0.0" as const;
export const DEFAULT_CANDIDATE_PASS_B_CAST_ROSTER_ID =
  "chzzk-video-13996057-v1" as const;

export type CandidatePassBCastRosterId =
  typeof DEFAULT_CANDIDATE_PASS_B_CAST_ROSTER_ID;

export interface CandidatePassBCastReference {
  readonly displayName: string;
  readonly role: CandidatePassBParticipantRole;
  readonly visualDescriptionKo: string;
}

/**
 * Closed-set references grounded from CHZZK replay 13996057. These are public
 * virtual-avatar traits, not open-world face or voice recognition. A model may
 * use them only when the supplied candidate frames show multiple distinctive
 * traits; otherwise the participant must remain unknown.
 */
const EXCHANGE_STUDENT_CAST = Object.freeze([
  {
    displayName: "토로리 코코",
    role: "guest",
    visualDescriptionKo:
      "하늘색 짧은 단발과 파란 눈, 흰색·파란색 머리 장식과 의상이 함께 보이는 아바타",
  },
  {
    displayName: "세나 아르벨",
    role: "guest",
    visualDescriptionKo:
      "긴 은백색 머리와 보라색 눈, 분홍·파랑 리본이 달린 검은 베레모가 함께 보이는 아바타",
  },
  {
    displayName: "망징이",
    role: "guest",
    visualDescriptionKo:
      "옅은 은청색의 굽은 단발과 파란 눈, 짙은 남색 계열 의상이 함께 보이는 아바타",
  },
  {
    displayName: "유레카",
    role: "guest",
    visualDescriptionKo:
      "끝부분이 초록색인 금발 단발과 초록 눈, 검은 베레모와 초록색 학원풍 의상이 함께 보이는 아바타",
  },
  {
    displayName: "아모레또",
    role: "guest",
    visualDescriptionKo:
      "긴 은분홍색 머리와 자홍색 눈, 고양이형 귀·꼬리와 흰 상의·분홍 소매가 함께 보이는 아바타",
  },
  {
    displayName: "교수님",
    role: "streamer",
    visualDescriptionKo:
      "검은 짧은 머리와 안경, 어두운 의상에 초록색 포인트가 함께 보이는 진행자 아바타",
  },
] satisfies readonly CandidatePassBCastReference[]);

export function isCandidatePassBCastRosterId(
  value: unknown,
): value is CandidatePassBCastRosterId {
  return value === DEFAULT_CANDIDATE_PASS_B_CAST_ROSTER_ID;
}

export function candidatePassBCastReferences(
  rosterId: CandidatePassBCastRosterId | null,
): readonly CandidatePassBCastReference[] {
  return rosterId === DEFAULT_CANDIDATE_PASS_B_CAST_ROSTER_ID
    ? EXCHANGE_STUDENT_CAST
    : [];
}

/**
 * The reviewed roster belongs to one broadcast and must never leak into an
 * unrelated source. Downloaders do not use one stable filename convention, so
 * accept either the public replay number or the distinctive reviewed title.
 */
export function candidatePassBCastRosterIdForSourceName(
  sourceName: string,
): CandidatePassBCastRosterId | null {
  if (typeof sourceName !== "string") return null;
  const normalized = sourceName.normalize("NFC").toLocaleLowerCase("ko-KR");
  const hasReplayNumber = /(?:^|\D)13996057(?:\D|$)/u.test(normalized);
  const hasReviewedTitle =
    normalized.includes("교환학생") &&
    normalized.includes("합격생") &&
    normalized.includes("장학생");
  return hasReplayNumber || hasReviewedTitle
    ? DEFAULT_CANDIDATE_PASS_B_CAST_ROSTER_ID
    : null;
}
