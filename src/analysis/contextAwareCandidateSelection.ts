import type { TemporalEventDensityBin } from "./temporalPointProcess";

export type CandidateSelectionEligibility =
  | "eligible"
  | "exploration"
  | "ineligible";

export interface ContextAwareSelectionOptions {
  readonly detailAnalysisBudget?: number;
  readonly explorationShare?: number;
  readonly qualityLambda?: number;
  /** Maximum span of fragments that may be collapsed into one event episode. */
  readonly eventEpisodeMergeMs?: number;
  /** Optional semantic gate. Ineligible candidates are never used to fill the budget. */
  readonly candidateEligibilityById?: Readonly<
    Record<string, CandidateSelectionEligibility>
  >;
  /** Absolute pre-normalization quality floor. Defaults to no floor. */
  readonly minimumAbsoluteScore?: number;
}

export interface SelectionDiagnostics {
  readonly selectedCandidateId: string;
  readonly selectionOrdinal: number;
  readonly eventEpisodeId: string;
  readonly episodeMemberCandidateIds: readonly string[];
  readonly baseQuality: number;
  readonly duplicateSimilarity: number;
  readonly coveragePenalty: number;
  readonly finalUtility: number;
  readonly selectionPass: "main" | "exploration";
  readonly blockIndex: number;
}

export interface SelectableCandidate {
  readonly id: string;
  readonly peakMs: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly score: number;
  readonly signalKinds?: readonly string[];
  readonly eventEpisodeId?: string;
  readonly evidenceKeys?: readonly string[];
  readonly evidence?: unknown;
}

export interface EventEpisode<
  TCandidate extends SelectableCandidate = SelectableCandidate,
> {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly peakMs: number;
  readonly representative: TCandidate;
  readonly memberCandidateIds: readonly string[];
  readonly signalKinds: readonly string[];
  readonly evidenceKeys: readonly string[];
  readonly eventKinds: readonly string[];
}

export interface ContextAwareSelectionSummary {
  readonly reservoirCandidateCount: number;
  readonly eligibleCandidateCount: number;
  readonly eventEpisodeCount: number;
  readonly selectedEpisodeCount: number;
  readonly rejectedIneligibleCount: number;
  readonly rejectedBelowQualityCount: number;
  readonly explorationSelectedCount: number;
  readonly unfilledBudget: number;
  readonly selectedByBlock: readonly number[];
}

export interface ContextAwareSelectionResult<
  TCandidate extends SelectableCandidate = SelectableCandidate,
> {
  readonly candidates: readonly TCandidate[];
  readonly diagnostics: readonly SelectionDiagnostics[];
  readonly summary: ContextAwareSelectionSummary;
}

interface EpisodeDraft<TCandidate extends SelectableCandidate> {
  startMs: number;
  endMs: number;
  representative: TCandidate;
  members: TCandidate[];
  signalKinds: Set<string>;
  evidenceKeys: Set<string>;
  eventKinds: Set<string>;
  explicitEpisodeIds: Set<string>;
}

interface SelectionDraft<TCandidate extends SelectableCandidate> {
  readonly episode: EventEpisode<TCandidate>;
  readonly candidate: TCandidate;
  readonly normalizedQuality: number;
  readonly blockIndex: number;
  readonly eligibility: CandidateSelectionEligibility;
  readonly isRecommended: boolean;
  duplicateSimilarity: number;
  coveragePenalty: number;
  workingUtility: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function readNestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const nested = Reflect.get(value, key) as unknown;
  return typeof nested === "object" && nested !== null
    ? (nested as Record<string, unknown>)
    : null;
}

function readEventKind(candidate: SelectableCandidate): string | null {
  if (typeof candidate.evidence === "object" && candidate.evidence !== null) {
    const direct = Reflect.get(candidate.evidence, "eventKind") as unknown;
    if (typeof direct === "string" && direct.length > 0) return direct;
  }
  const audio = readNestedRecord(candidate.evidence, "audio");
  return typeof audio?.eventKind === "string" && audio.eventKind.length > 0
    ? audio.eventKind
    : null;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function intersects(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function compareCandidateStrength(
  left: SelectableCandidate,
  right: SelectableCandidate,
): number {
  return (
    finiteOr(right.score, 0) - finiteOr(left.score, 0) ||
    finiteOr(left.peakMs, 0) - finiteOr(right.peakMs, 0) ||
    left.id.localeCompare(right.id)
  );
}

function canJoinEpisode<TCandidate extends SelectableCandidate>(
  episode: EpisodeDraft<TCandidate>,
  candidate: TCandidate,
  maximumEpisodeSpanMs: number,
): boolean {
  const combinedStart = Math.min(episode.startMs, candidate.startMs);
  const combinedEnd = Math.max(episode.endMs, candidate.endMs);
  if (combinedEnd - combinedStart > maximumEpisodeSpanMs) return false;

  const candidateExplicitIds = new Set(
    candidate.eventEpisodeId ? [candidate.eventEpisodeId] : [],
  );
  if (intersects(episode.explicitEpisodeIds, candidateExplicitIds)) return true;

  const candidateKeys = new Set(candidate.evidenceKeys ?? []);
  const sharesEvidence = intersects(episode.evidenceKeys, candidateKeys);
  const overlapMs = Math.max(
    0,
    Math.min(candidate.endMs, episode.endMs) -
      Math.max(candidate.startMs, episode.startMs),
  );
  const candidateDurationMs = Math.max(1, candidate.endMs - candidate.startMs);
  const episodeDurationMs = Math.max(1, episode.endMs - episode.startMs);
  const overlapRatio = overlapMs / Math.min(candidateDurationMs, episodeDurationMs);
  const peakDistanceMs = Math.abs(candidate.peakMs - episode.representative.peakMs);
  if (overlapRatio >= 0.35 || (overlapMs > 0 && peakDistanceMs <= 30_000)) {
    return true;
  }

  const gapMs = Math.max(0, candidate.startMs - episode.endMs);
  if (sharesEvidence && gapMs <= maximumEpisodeSpanMs) return true;

  // A generic detector label such as `sustained-vocal-reaction` is not event
  // identity. Using it alone would collapse separate reactions in a dense stream.
  return false;
}

/**
 * Collapses multiple detector fragments from one real-world moment before density
 * estimation or MMR selection. It deliberately refuses unbounded transitive chains.
 */
export function buildEventEpisodes<TCandidate extends SelectableCandidate>(
  candidates: readonly TCandidate[],
  maximumEpisodeSpanMs = 90_000,
): readonly EventEpisode<TCandidate>[] {
  const safeMaximumSpanMs = clamp(finiteOr(maximumEpisodeSpanMs, 90_000), 30_000, 90_000);
  const ordered = [...candidates].sort(
    (left, right) =>
      left.startMs - right.startMs ||
      left.peakMs - right.peakMs ||
      left.id.localeCompare(right.id),
  );
  const drafts: EpisodeDraft<TCandidate>[] = [];

  for (const candidate of ordered) {
    const eventKind = readEventKind(candidate);
    let target: EpisodeDraft<TCandidate> | undefined;
    for (let index = drafts.length - 1; index >= 0; index -= 1) {
      const draft = drafts[index]!;
      if (candidate.startMs - draft.endMs > safeMaximumSpanMs) break;
      if (canJoinEpisode(draft, candidate, safeMaximumSpanMs)) {
        target = draft;
        break;
      }
    }

    if (target === undefined) {
      drafts.push({
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        representative: candidate,
        members: [candidate],
        signalKinds: new Set(candidate.signalKinds ?? []),
        evidenceKeys: new Set(candidate.evidenceKeys ?? []),
        eventKinds: new Set(eventKind === null ? [] : [eventKind]),
        explicitEpisodeIds: new Set(
          candidate.eventEpisodeId ? [candidate.eventEpisodeId] : [],
        ),
      });
      continue;
    }

    target.startMs = Math.min(target.startMs, candidate.startMs);
    target.endMs = Math.max(target.endMs, candidate.endMs);
    target.members.push(candidate);
    if (compareCandidateStrength(candidate, target.representative) < 0) {
      target.representative = candidate;
    }
    for (const kind of candidate.signalKinds ?? []) target.signalKinds.add(kind);
    for (const key of candidate.evidenceKeys ?? []) target.evidenceKeys.add(key);
    if (eventKind !== null) target.eventKinds.add(eventKind);
    if (candidate.eventEpisodeId) target.explicitEpisodeIds.add(candidate.eventEpisodeId);
  }

  return drafts.map((draft, index) => {
    const memberCandidateIds = sortedUnique(draft.members.map((item) => item.id));
    const explicitId = sortedUnique(draft.explicitEpisodeIds)[0];
    return {
      id: explicitId ?? `episode-${index.toString().padStart(3, "0")}-${memberCandidateIds[0]}`,
      startMs: draft.startMs,
      endMs: draft.endMs,
      peakMs: draft.representative.peakMs,
      representative: draft.representative,
      memberCandidateIds,
      signalKinds: sortedUnique(draft.signalKinds),
      evidenceKeys: sortedUnique(draft.evidenceKeys),
      eventKinds: sortedUnique(draft.eventKinds),
    };
  });
}

function calculateBlockQuotas(
  sourceDurationMs: number,
  detailAnalysisBudget: number,
  densityBins: readonly TemporalEventDensityBin[],
): { blockMs: number; quotas: number[] } {
  const minBlockMs = 15 * 60_000;
  const maxBlockMs = 45 * 60_000;
  const blockMs = clamp(
    sourceDurationMs / Math.max(1, detailAnalysisBudget * 2),
    minBlockMs,
    maxBlockMs,
  );
  const blockCount = Math.max(1, Math.ceil(sourceDurationMs / blockMs));
  const expectedByBlock = new Array<number>(blockCount).fill(0);

  for (const bin of densityBins) {
    const centerMs = (bin.startMs + bin.endMs) / 2;
    const blockIndex = clamp(Math.floor(centerMs / blockMs), 0, blockCount - 1);
    expectedByBlock[blockIndex]! += Math.max(0, finiteOr(bin.expectedEventCount, 0));
  }

  // Square-root allocation prevents a dense burst from monopolizing the budget,
  // while remaining a soft preference rather than a hard per-block cap.
  const weights = expectedByBlock.map((expected) => Math.sqrt(expected + 0.25));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const quotas = weights.map((weight) =>
    totalWeight > 0 ? (weight / totalWeight) * detailAnalysisBudget : detailAnalysisBudget / blockCount,
  );
  return { blockMs, quotas };
}

function intervalOverlapRatio(left: SelectableCandidate, right: SelectableCandidate): number {
  const overlap = Math.max(
    0,
    Math.min(left.endMs, right.endMs) - Math.max(left.startMs, right.startMs),
  );
  const shorter = Math.max(
    1,
    Math.min(left.endMs - left.startMs, right.endMs - right.startMs),
  );
  return clamp(overlap / shorter, 0, 1);
}

function episodeSimilarity(
  left: EventEpisode,
  right: EventEpisode,
): number {
  const overlap = intervalOverlapRatio(left.representative, right.representative);
  const distanceMs = Math.abs(left.peakMs - right.peakMs);
  const temporal = Math.exp(-Math.pow(distanceMs / 90_000, 2));
  const leftKeys = new Set(left.evidenceKeys);
  const rightKeys = new Set(right.evidenceKeys);
  const leftKinds = new Set(left.eventKinds);
  const rightKinds = new Set(right.eventKinds);
  const leftSignals = new Set(left.signalKinds);
  const rightSignals = new Set(right.signalKinds);

  let contextual = 0.1 * temporal;
  if (intersects(leftSignals, rightSignals)) contextual = Math.max(contextual, 0.2 * temporal);
  if (intersects(leftKinds, rightKinds)) contextual = Math.max(contextual, 0.45 * temporal);
  if (intersects(leftKeys, rightKeys)) contextual = Math.max(contextual, 0.8 * temporal);
  return clamp(Math.max(overlap, contextual), 0, 1);
}

function normalizeQualities<TCandidate extends SelectableCandidate>(
  episodes: readonly EventEpisode<TCandidate>[],
): Map<string, number> {
  const scores = episodes.map((episode) => finiteOr(episode.representative.score, 0));
  const minimum = Math.min(...scores);
  const maximum = Math.max(...scores);
  const range = maximum - minimum;
  return new Map(
    episodes.map((episode) => {
      const score = finiteOr(episode.representative.score, 0);
      const normalized = range > Number.EPSILON
        ? (score - minimum) / range
        : clamp(score, 0, 1);
      return [episode.id, clamp(normalized, 0, 1)];
    }),
  );
}

export function selectContextAwareCandidates<TCandidate extends SelectableCandidate>(
  reservoir: readonly TCandidate[],
  sourceDurationMs: number,
  densityBins: readonly TemporalEventDensityBin[],
  recommendedCandidateIds: readonly string[] = [],
  options: ContextAwareSelectionOptions = {},
): ContextAwareSelectionResult<TCandidate> {
  const detailAnalysisBudget = Math.max(0, Math.floor(options.detailAnalysisBudget ?? 12));
  const explorationShare = clamp(options.explorationShare ?? 0.15, 0, 0.5);
  const qualityLambda = clamp(options.qualityLambda ?? 0.75, 0, 1);
  const minimumAbsoluteScore = options.minimumAbsoluteScore ?? -Infinity;
  const eligibilityById = options.candidateEligibilityById ?? {};
  const emptySummary = (overrides: Partial<ContextAwareSelectionSummary> = {}): ContextAwareSelectionSummary => ({
    reservoirCandidateCount: reservoir.length,
    eligibleCandidateCount: 0,
    eventEpisodeCount: 0,
    selectedEpisodeCount: 0,
    rejectedIneligibleCount: 0,
    rejectedBelowQualityCount: 0,
    explorationSelectedCount: 0,
    unfilledBudget: detailAnalysisBudget,
    selectedByBlock: [],
    ...overrides,
  });

  if (reservoir.length === 0 || detailAnalysisBudget === 0) {
    return { candidates: [], diagnostics: [], summary: emptySummary() };
  }

  const rejectedIneligibleCount = reservoir.filter(
    (candidate) => eligibilityById[candidate.id] === "ineligible",
  ).length;
  const rejectedBelowQualityCount = reservoir.filter(
    (candidate) =>
      eligibilityById[candidate.id] !== "ineligible" &&
      finiteOr(candidate.score, -Infinity) < minimumAbsoluteScore,
  ).length;
  const eligibleReservoir = reservoir.filter(
    (candidate) =>
      eligibilityById[candidate.id] !== "ineligible" &&
      finiteOr(candidate.score, -Infinity) >= minimumAbsoluteScore,
  );
  if (eligibleReservoir.length === 0) {
    return {
      candidates: [],
      diagnostics: [],
      summary: emptySummary({ rejectedIneligibleCount, rejectedBelowQualityCount }),
    };
  }

  const episodes = buildEventEpisodes(
    eligibleReservoir,
    options.eventEpisodeMergeMs ?? 90_000,
  );
  const normalizedQualities = normalizeQualities(episodes);
  const { blockMs, quotas } = calculateBlockQuotas(
    Math.max(1, sourceDurationMs),
    detailAnalysisBudget,
    densityBins,
  );
  const blockUsage = new Array<number>(quotas.length).fill(0);
  const recommended = new Set(recommendedCandidateIds);

  const drafts: SelectionDraft<TCandidate>[] = episodes.map((episode) => {
    const representative = episode.representative;
    const memberEligibility = episode.memberCandidateIds.map(
      (id) => eligibilityById[id] ?? "eligible",
    );
    return {
      episode,
      candidate: representative,
      normalizedQuality: normalizedQualities.get(episode.id) ?? 0,
      blockIndex: clamp(Math.floor(episode.peakMs / blockMs), 0, quotas.length - 1),
      eligibility: memberEligibility.includes("eligible") ? "eligible" : "exploration",
      isRecommended: episode.memberCandidateIds.some((id) => recommended.has(id)),
      duplicateSimilarity: 0,
      coveragePenalty: 1,
      workingUtility: 0,
    };
  });
  const selected: SelectionDraft<TCandidate>[] = [];
  const diagnostics: SelectionDiagnostics[] = [];
  const representedBlocks = new Set<number>();
  const representedSignals = new Set<string>();

  const updateUtility = (draft: SelectionDraft<TCandidate>): void => {
    const quota = Math.max(0.25, quotas[draft.blockIndex] ?? 0.25);
    const overage = Math.max(0, (blockUsage[draft.blockIndex] ?? 0) - quota + 1);
    draft.coveragePenalty = 1 / (1 + 0.35 * overage);
    const novelty = 1 - draft.duplicateSimilarity;
    const baseUtility = qualityLambda * draft.normalizedQuality + (1 - qualityLambda) * novelty;
    const contextBonus = draft.isRecommended ? 0.08 : 0;
    draft.workingUtility = baseUtility * draft.coveragePenalty + contextBonus;
  };

  const choose = (
    pool: SelectionDraft<TCandidate>[],
    pass: "main" | "exploration",
  ): boolean => {
    if (pool.length === 0) return false;
    for (const draft of pool) updateUtility(draft);
    pool.sort(
      (left, right) =>
        right.workingUtility - left.workingUtility ||
        right.normalizedQuality - left.normalizedQuality ||
        left.candidate.peakMs - right.candidate.peakMs ||
        left.candidate.id.localeCompare(right.candidate.id),
    );
    const winner = pool[0]!;
    const draftIndex = drafts.indexOf(winner);
    if (draftIndex < 0) return false;
    drafts.splice(draftIndex, 1);
    selected.push(winner);
    blockUsage[winner.blockIndex] = (blockUsage[winner.blockIndex] ?? 0) + 1;
    representedBlocks.add(winner.blockIndex);
    for (const signal of winner.episode.signalKinds) representedSignals.add(signal);
    diagnostics.push({
      selectedCandidateId: winner.candidate.id,
      selectionOrdinal: diagnostics.length + 1,
      eventEpisodeId: winner.episode.id,
      episodeMemberCandidateIds: winner.episode.memberCandidateIds,
      baseQuality: winner.normalizedQuality,
      duplicateSimilarity: winner.duplicateSimilarity,
      coveragePenalty: winner.coveragePenalty,
      finalUtility: winner.workingUtility,
      selectionPass: pass,
      blockIndex: winner.blockIndex,
    });
    for (const remaining of drafts) {
      remaining.duplicateSimilarity = Math.max(
        remaining.duplicateSimilarity,
        episodeSimilarity(winner.episode, remaining.episode),
      );
    }
    return true;
  };

  const explorationSlots = Math.min(
    detailAnalysisBudget,
    Math.round(detailAnalysisBudget * explorationShare),
  );
  const mainSlots = detailAnalysisBudget - explorationSlots;
  while (selected.length < mainSlots && drafts.length > 0) {
    const mainPool = drafts.filter((draft) => draft.eligibility === "eligible");
    if (!choose(mainPool, "main")) break;
  }

  let explorationSelectedCount = 0;
  while (selected.length < detailAnalysisBudget && drafts.length > 0) {
    const explorationPool = drafts.filter(
      (draft) =>
        !representedBlocks.has(draft.blockIndex) ||
        draft.episode.signalKinds.some((signal) => !representedSignals.has(signal)),
    );
    if (explorationPool.length > 0) {
      if (!choose(explorationPool, "exploration")) break;
      explorationSelectedCount += 1;
      continue;
    }

    // Return unused exploration capacity to qualified main candidates. Never
    // fill it with a semantically ineligible or below-floor event.
    const qualifiedMainPool = drafts.filter((draft) => draft.eligibility === "eligible");
    if (!choose(qualifiedMainPool, "main")) break;
  }

  const chronologicalCandidates = selected
    .map((draft) => draft.candidate)
    .sort(
      (left, right) =>
        left.peakMs - right.peakMs || left.id.localeCompare(right.id),
    );

  return {
    candidates: chronologicalCandidates,
    diagnostics,
    summary: {
      reservoirCandidateCount: reservoir.length,
      eligibleCandidateCount: eligibleReservoir.length,
      eventEpisodeCount: episodes.length,
      selectedEpisodeCount: selected.length,
      rejectedIneligibleCount,
      rejectedBelowQualityCount,
      explorationSelectedCount,
      unfilledBudget: Math.max(0, detailAnalysisBudget - selected.length),
      selectedByBlock: blockUsage,
    },
  };
}
