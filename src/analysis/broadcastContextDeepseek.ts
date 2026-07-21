import {
  BROADCAST_CONTEXT_SCHEMA_VERSION,
  type BroadcastContextCandidateCategory,
  type BroadcastContextClipDecision,
  type BroadcastContextRejectionReason,
  type BroadcastContextRequest,
  type BroadcastContextResult,
  calculateCoverage,
  normalizeDiscoveredLeads,
  normalizeSemanticChapters,
  type BroadcastContextDiscoveredLead,
  type BroadcastContextDiscoveredLeadCategory,
  type BroadcastContextDiscoveredLeadReference,
  type BroadcastContextSemanticChapterReference,
  type BroadcastContextSemanticChapter,
  type BroadcastContextSemanticChapterKind,
  type BroadcastContextSemanticChapterSalience,
} from "./broadcastContextProtocol";

export const BROADCAST_CONTEXT_DEEPSEEK_ENDPOINT =
  "https://api.deepseek.com/chat/completions" as const;
export const MAX_BROADCAST_CONTEXT_DEEPSEEK_RESPONSE_BYTES = 256 * 1024;

export interface BroadcastContextDeepseekRequestBody {
  readonly model: string;
  readonly messages: readonly [
    { readonly role: "system"; readonly content: string },
    { readonly role: "user"; readonly content: string },
  ];
  readonly response_format: { readonly type: "json_object" };
  readonly temperature: number;
  readonly max_tokens: number;
  readonly thinking: { readonly type: "enabled" };
  readonly reasoning_effort: "high";
}

export interface BroadcastContextQwenRequestBody {
  readonly model: string;
  readonly messages: BroadcastContextDeepseekRequestBody["messages"];
  readonly response_format: { readonly type: "json_object" };
  readonly temperature: number;
  readonly max_tokens: number;
  readonly enable_thinking: true;
  readonly thinking_budget: number;
}

export type BroadcastContextDeepseekParseOutcome =
  | { readonly ok: true; readonly result: BroadcastContextResult }
  | { readonly ok: false };

const SYSTEM_PROMPT = `당신은 긴 인터넷 방송(라이브 스트리밍)의 전체 흐름과 맥락을 파악하여, 특정 하이라이트 구간(후보)들이 전체 방송에서 어떤 역할을 하는지 분류하고 방송을 의미 단위로 묶는(Semantic Chapters) 전문 편집 어시스턴트입니다.

## 입력 데이터 형식
사용자는 방송을 시간순으로 요약한 여러 개의 '챕터(Chapters)' 정보와, 집중 분석 대상인 '후보(Candidates)' 정보들을 제공합니다. 

## 출력 데이터 형식
당신은 반드시 아래의 JSON 스키마를 따르는 응답만 생성해야 합니다.
{
  "broadcastSummaryKo": "방송 전체의 흐름을 300~500자로 요약",
  "recurringThemesKo": ["방송 전체를 관통하는 주요 밈이나 반복되는 이야기"],
  "semanticChapters": [
    {
      "startChapterId": "이 의미 단락이 시작되는 챕터 ID",
      "endChapterId": "이 의미 단락이 끝나는 챕터 ID",
      "titleKo": "의미 단락의 제목 (64자 이내)",
      "summaryKo": "의미 단락의 요약 (1200자 이내)",
      "kind": "main-event" | "story-progress" | "setup-and-payoff" | "running-gag" | "quiet-achievement" | "reaction" | "context-shift" | "other",
      "salience": "primary" | "secondary",
      "relatedCandidateIds": ["이 단락에 포함되거나 연관된 후보 ID들"],
      "uncertaintiesKo": ["이 단락에 대해 확신하기 어려운 부분 (없으면 빈 배열)"]
    }
  ],
  "discoveredLeads": [
    {
      "leadId": "새로 발견한 의미 후보의 고유 ID",
      "startChapterId": "근거가 시작되는 실제 chapter ID",
      "endChapterId": "근거가 끝나는 실제 chapter ID",
      "category": "reaction" | "quiet-achievement" | "setup-and-payoff" | "running-gag" | "context-dependent" | "apology-accountability",
      "confidence": 0.0부터 1.0 사이 숫자,
      "eventSummaryKo": "실제로 어떤 사건이 있었는지",
      "whyThisMomentKo": "왜 짧은 클립 후보로 다시 확인할 가치가 있는지",
      "evidenceCueKo": "제공된 대사 요약에서 확인되는 짧은 근거",
      "uncertaintiesKo": ["화면·정확한 초 단위 위치 등 아직 확인할 점"]
    }
  ],
  "annotations": [
    {
      "candidateId": "후보의 ID",
      "category": "reaction" | "quiet-achievement" | "setup-and-payoff" | "running-gag" | "context-dependent" | "apology-accountability" | "music-or-intermission" | "not-clip-worthy" | "uncertain",
      "clipDecision": "select" | "review" | "reject",
      "confidence": 0.0부터 1.0 사이 숫자,
      "rejectionReasons": ["music-or-song" | "opening-ending-or-break" | "no-distinct-event" | "reaction-without-context" | "insufficient-context" | "duplicate-episode" | "uncertain-evidence"],
      "contextSummaryKo": "이 클립이 전체 맥락에서 가지는 의미 (100자 내외)",
      "whyThisMomentKo": "이 클립을 하이라이트로 뽑자 만한 구체적 이유 (100자 내외)",
      "relatedCandidateIds": ["이 클립과 스토리가 이어지거나 연관된 다른 candidateId 배열"],
      "uncertaintiesKo": ["이 클립만으로 확신하기 어려운 점"]
    }
  ]
}

## 카테고리(category) 분류 기준
각 후보는 다음 중 하나의 카테고리를 가져야 합니다.
- reaction (반응): 앞뒤 맥락과 무관하게 스트리머의 단발성 리액션이나 텐션으로 재미있는 장면
- quiet-achievement (조용한 성취): 큰 소리나 리액션은 없지만 게임 내에서 어려운 목표를 달성하거나 엄청난 플레이를 한 장면
- setup-and-payoff (설정과 회수): 앞선 챕터에서 빌드업된 사건(설정)이 해당 구간에서 회수(터짐)된 장면
- running-gag (반복 개그): 방송 내내 여러 번 반복되는 밈(Meme)이나 개그 패턴의 일부인 장면
- context-dependent (맥락 의존): 단독으로 보면 재미없지만, 전체 챕터 맥락을 알아야만 웃긴 장면
- apology-accountability (사과·해명): 실수나 논란의 정확한 인정·사과·해명 장면
- music-or-intermission (음악·대기): 노래, MV, 오프닝, 엔딩, 중간 휴식처럼 반복 가능한 구간
- not-clip-worthy (클립 가치 없음): 사건이나 반응의 완결성이 없는 평범하고 단편적인 진행
- uncertain (불확실): 텍스트 정보만으로는 분류하기 애매한 장면

## 최종 선택 원칙
- 후보 수를 채우지 마세요. 의미 있는 후보가 없으면 모든 후보를 reject로 판정하는 것이 정답입니다.
- 큰 소리나 화면 전환만으로 select하지 마세요. 구체적인 사건과 스트리머의 반응 또는 의미 있는 행동이 있어야 합니다.
- 노래·MV·음악만 있는 구간, 고정 오프닝·엔딩·대기·휴식은 그 안에 고유한 발화 사건이 없다면 반드시 reject입니다.
- 전체 맥락 없이 단편적인 상황만 보이고 독립적인 클립 가치가 없다면 reject입니다.
- 실수·논란 방송에서는 실제로 잘못을 인정하고 사과하거나 해명하는 정확한 장면을 찾고, 그 전후의 무관한 반응은 reject합니다.
- select는 맥락과 근거가 충분한 경우, review는 잠재 가치는 있으나 증거가 부족한 경우에만 사용하세요.
- 챕터의 근거 모드가 표본이고 커버리지가 낮다면 방송 전체를 안다고 가장하지 마세요. 후보 자체의 오디오·화면 근거로도 사건을 확정하지 못하면 review 또는 insufficient-context reject를 사용하세요.
- reject일 때는 rejectionReasons를 하나 이상, select일 때는 빈 배열로 반환하세요.
- 빠른 소리 탐색 후보와 별개로, 대사 챕터에서 조용한 성공·정확한 사과·중요한 결정·설정 회수처럼 다시 볼 가치가 있는 순간을 discoveredLeads에 최대 12개까지 제안하세요.
- discoveredLeads는 제공된 chapter ID 범위만 참조해야 하며 초 단위 위치를 지어내지 마세요. 후속 영상 재검증이 정확한 30초~1분 경계를 정합니다.
- 발견 근거가 한 챕터에 있으면 startChapterId와 endChapterId를 같은 ID로 두고, 반드시 가장 작은 근거 범위를 선택하세요.
- 노래·MV·오프닝·엔딩·대기·휴식, 맥락 없는 단편, 이미 주어진 후보와 같은 사건은 discoveredLeads에 넣지 마세요.
- 의미 있는 새 사건이 없다면 discoveredLeads는 빈 배열이어야 합니다.`;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function buildBroadcastContextDeepseekRequestBody(
  request: BroadcastContextRequest,
  model: string = "deepseek-v4-pro",
): BroadcastContextDeepseekRequestBody {
  let userContent = `총 방송 길이: ${formatDuration(request.sourceDurationMs)}\n\n`;
  userContent += `### 방송 챕터 요약 (시간순)\n`;
  for (const chapter of request.chapters) {
    userContent += `- [${formatDuration(chapter.startMs)} ~ ${formatDuration(chapter.endMs)}] (ID: ${chapter.chapterId}, 근거: ${chapter.evidenceMode}, 커버리지: ${Math.round(chapter.evidenceCoverageRatio * 100)}%): ${chapter.summaryKo}\n`;
  }
  userContent += `\n### 분석 대상 후보 (Candidates)\n`;
  for (const candidate of request.candidates) {
    userContent += `\n==== 후보 ID: ${candidate.candidateId} ====\n`;
    userContent += `구간: ${formatDuration(candidate.startMs)} ~ ${formatDuration(candidate.endMs)}\n`;
    userContent += `대화 요약:\n${candidate.transcriptKo}\n`;
    userContent += `사건 요약: ${candidate.eventSummaryKo}\n`;
    userContent += `반응 요약: ${candidate.reactionSummaryKo}\n`;
    if (candidate.chatReactionSummaryKo) {
      userContent += `채팅 요약: ${candidate.chatReactionSummaryKo}\n`;
    }
  }

  return {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 8192,
    thinking: { type: "enabled" },
    reasoning_effort: "high",
  };
}

/** Official OpenAI-compatible Qwen hybrid-thinking variant of the same task. */
export function buildBroadcastContextQwenRequestBody(
  request: BroadcastContextRequest,
  model = "qwen3.7-plus",
): BroadcastContextQwenRequestBody {
  const deepseekBody = buildBroadcastContextDeepseekRequestBody(request, model);
  return {
    model: deepseekBody.model,
    messages: deepseekBody.messages,
    response_format: deepseekBody.response_format,
    temperature: deepseekBody.temperature,
    max_tokens: deepseekBody.max_tokens,
    enable_thinking: true,
    thinking_budget: 4_096,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidCategory(value: string): value is BroadcastContextCandidateCategory {
  return [
    "reaction",
    "quiet-achievement",
    "setup-and-payoff",
    "running-gag",
    "context-dependent",
    "apology-accountability",
    "music-or-intermission",
    "not-clip-worthy",
    "uncertain",
  ].includes(value);
}

function isValidClipDecision(value: string): value is BroadcastContextClipDecision {
  return ["select", "review", "reject"].includes(value);
}

function isValidRejectionReason(value: string): value is BroadcastContextRejectionReason {
  return [
    "music-or-song",
    "opening-ending-or-break",
    "no-distinct-event",
    "reaction-without-context",
    "insufficient-context",
    "duplicate-episode",
    "uncertain-evidence",
  ].includes(value);
}

function isValidSemanticKind(value: string): boolean {
  return [
    "main-event",
    "story-progress",
    "setup-and-payoff",
    "running-gag",
    "quiet-achievement",
    "reaction",
    "context-shift",
    "other",
  ].includes(value);
}

function isValidSemanticSalience(value: string): boolean {
  return ["primary", "secondary"].includes(value);
}

function isValidDiscoveredLeadCategory(
  value: string,
): value is BroadcastContextDiscoveredLeadCategory {
  return [
    "reaction",
    "quiet-achievement",
    "setup-and-payoff",
    "running-gag",
    "context-dependent",
    "apology-accountability",
  ].includes(value);
}

export function extractBroadcastContextDeepseekResponse(
  payload: unknown,
  request: BroadcastContextRequest
): BroadcastContextDeepseekParseOutcome {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return { ok: false };
  }

  const choice: unknown = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    return { ok: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch {
    return { ok: false };
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.broadcastSummaryKo !== "string" ||
    !isStringArray(parsed.recurringThemesKo) ||
    !Array.isArray(parsed.annotations)
  ) {
    return { ok: false };
  }

  const annotations = [];
  const requestedCandidateIds = new Set(
    request.candidates.map((candidate) => candidate.candidateId),
  );
  const seenCandidateIds = new Set<string>();
  for (const ann of parsed.annotations) {
    if (
      !isRecord(ann) ||
      typeof ann.candidateId !== "string" ||
      !requestedCandidateIds.has(ann.candidateId) ||
      seenCandidateIds.has(ann.candidateId) ||
      typeof ann.category !== "string" ||
      !isValidCategory(ann.category) ||
      typeof ann.clipDecision !== "string" ||
      !isValidClipDecision(ann.clipDecision) ||
      typeof ann.confidence !== "number" ||
      !Number.isFinite(ann.confidence) ||
      ann.confidence < 0 ||
      ann.confidence > 1 ||
      !isStringArray(ann.rejectionReasons) ||
      !ann.rejectionReasons.every(isValidRejectionReason) ||
      (ann.clipDecision === "reject" && ann.rejectionReasons.length === 0) ||
      (ann.clipDecision === "select" && ann.rejectionReasons.length > 0) ||
      typeof ann.contextSummaryKo !== "string" ||
      typeof ann.whyThisMomentKo !== "string" ||
      !isStringArray(ann.relatedCandidateIds) ||
      !isStringArray(ann.uncertaintiesKo)
    ) {
      return { ok: false };
    }
    seenCandidateIds.add(ann.candidateId);
    annotations.push({
      candidateId: ann.candidateId,
      category: ann.category,
      clipDecision: ann.clipDecision,
      confidence: ann.confidence,
      rejectionReasons: ann.rejectionReasons,
      contextSummaryKo: ann.contextSummaryKo,
      whyThisMomentKo: ann.whyThisMomentKo,
      relatedCandidateIds: ann.relatedCandidateIds,
      uncertaintiesKo: ann.uncertaintiesKo,
    });
  }
  if (seenCandidateIds.size !== requestedCandidateIds.size) {
    return { ok: false };
  }

  const rawSemanticChapters: BroadcastContextSemanticChapterReference[] = [];
  if (Array.isArray(parsed.semanticChapters)) {
    for (const sc of parsed.semanticChapters) {
      if (
        !isRecord(sc) ||
        typeof sc.startChapterId !== "string" ||
        typeof sc.endChapterId !== "string" ||
        typeof sc.titleKo !== "string" ||
        typeof sc.summaryKo !== "string" ||
        typeof sc.kind !== "string" ||
        !isValidSemanticKind(sc.kind) ||
        typeof sc.salience !== "string" ||
        !isValidSemanticSalience(sc.salience) ||
        !isStringArray(sc.relatedCandidateIds) ||
        !isStringArray(sc.uncertaintiesKo)
      ) {
        continue;
      }
      rawSemanticChapters.push({
        startChapterId: sc.startChapterId,
        endChapterId: sc.endChapterId,
        titleKo: sc.titleKo,
        summaryKo: sc.summaryKo,
        kind: sc.kind as BroadcastContextSemanticChapterKind,
        salience: sc.salience as BroadcastContextSemanticChapterSalience,
        relatedCandidateIds: sc.relatedCandidateIds,
        uncertaintiesKo: sc.uncertaintiesKo,
      });
    }
  }

  const coverage = calculateCoverage(request.chapters, request.sourceDurationMs);
  let semanticChapters: readonly BroadcastContextSemanticChapter[] = [];
  try {
    semanticChapters = normalizeSemanticChapters(rawSemanticChapters, request.chapters, coverage.gaps);
  } catch {
    // If normalization fails, just return empty semantic chapters
  }

  const rawDiscoveredLeads: BroadcastContextDiscoveredLeadReference[] = [];
  if (Array.isArray(parsed.discoveredLeads)) {
    for (const lead of parsed.discoveredLeads) {
      if (
        !isRecord(lead) ||
        typeof lead.leadId !== "string" ||
        typeof lead.startChapterId !== "string" ||
        typeof lead.endChapterId !== "string" ||
        typeof lead.category !== "string" ||
        !isValidDiscoveredLeadCategory(lead.category) ||
        typeof lead.confidence !== "number" ||
        !Number.isFinite(lead.confidence) ||
        lead.confidence < 0 ||
        lead.confidence > 1 ||
        typeof lead.eventSummaryKo !== "string" ||
        typeof lead.whyThisMomentKo !== "string" ||
        typeof lead.evidenceCueKo !== "string" ||
        !isStringArray(lead.uncertaintiesKo)
      ) {
        return { ok: false };
      }
      rawDiscoveredLeads.push({
        leadId: lead.leadId,
        startChapterId: lead.startChapterId,
        endChapterId: lead.endChapterId,
        category: lead.category,
        confidence: lead.confidence,
        eventSummaryKo: lead.eventSummaryKo,
        whyThisMomentKo: lead.whyThisMomentKo,
        evidenceCueKo: lead.evidenceCueKo,
        uncertaintiesKo: lead.uncertaintiesKo,
      });
    }
  }
  let discoveredLeads: readonly BroadcastContextDiscoveredLead[];
  try {
    discoveredLeads = normalizeDiscoveredLeads(
      rawDiscoveredLeads,
      request.chapters,
    );
  } catch {
    return { ok: false };
  }

  return {
    ok: true,
    result: {
      schemaVersion: BROADCAST_CONTEXT_SCHEMA_VERSION,
      broadcastSummaryKo: parsed.broadcastSummaryKo,
      recurringThemesKo: parsed.recurringThemesKo,
      annotations,
      semanticChaptersSupported: true,
      semanticChapters,
      discoveredLeadsSupported: Array.isArray(parsed.discoveredLeads),
      discoveredLeads,
      coverage,
    },
  };
}
