import type { TemporalEventDensityBin } from "./temporalPointProcess";

export interface ContextAwareSelectionOptions {
  readonly detailAnalysisBudget?: number; // default 12
  readonly explorationShare?: number; // default 0.15
  readonly qualityLambda?: number; // default 0.75
  readonly eventEpisodeMergeMs?: number; // default 90_000
}

export interface SelectionDiagnostics {
  readonly selectedCandidateId: string;
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
  readonly evidence?: unknown;
}

export interface ContextAwareSelectionResult<TCandidate extends SelectableCandidate = SelectableCandidate> {
  readonly candidates: readonly TCandidate[];
  readonly diagnostics: readonly SelectionDiagnostics[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// Calculate coverage block soft quota
function calculateBlockQuotas(
  sourceDurationMs: number,
  detailAnalysisBudget: number,
  densityBins: readonly TemporalEventDensityBin[],
): { blockMs: number; expectedEventsByBlock: number[]; quotas: number[] } {
  const minBlock = 15 * 60 * 1000;
  const maxBlock = 45 * 60 * 1000;
  
  // Safe default logic for block size
  const calculatedBlock = sourceDurationMs / (detailAnalysisBudget * 2 || 1);
  const blockMs = clamp(calculatedBlock, minBlock, maxBlock);

  const blockCount = Math.max(1, Math.ceil(sourceDurationMs / blockMs));
  const expectedEventsByBlock: number[] = new Array<number>(blockCount).fill(0);

  // Distribute bin expected events into blocks
  for (const bin of densityBins) {
    if (bin.expectedEventCount > 0) {
      const centerMs = (bin.startMs + bin.endMs) / 2;
      const blockIndex = clamp(Math.floor(centerMs / blockMs), 0, blockCount - 1);
      expectedEventsByBlock[blockIndex]! += bin.expectedEventCount;
    }
  }

  const totalExpected = expectedEventsByBlock.reduce((a, b) => a + b, 0);

  // Quota for each block proportional to expected events
  const quotas = expectedEventsByBlock.map(exp => {
    if (totalExpected === 0) {
      return Math.max(1, Math.round(detailAnalysisBudget / blockCount));
    }
    const rawQuota = (exp / totalExpected) * detailAnalysisBudget;
    return Math.max(1, Math.round(rawQuota));
  });

  return { blockMs, expectedEventsByBlock, quotas };
}

export function selectContextAwareCandidates<TCandidate extends SelectableCandidate>(
  reservoir: readonly TCandidate[],
  sourceDurationMs: number,
  densityBins: readonly TemporalEventDensityBin[],
  recommendedCandidateIds: readonly string[] = [],
  options: ContextAwareSelectionOptions = {}
): ContextAwareSelectionResult<TCandidate> {
  const detailAnalysisBudget = options.detailAnalysisBudget ?? 12;
  const explorationShare = options.explorationShare ?? 0.15;
  const qualityLambda = options.qualityLambda ?? 0.75;
  
  if (reservoir.length === 0) {
    return { candidates: [], diagnostics: [] };
  }

  const explorationBudget = Math.round(detailAnalysisBudget * explorationShare);
  const mainBudget = detailAnalysisBudget - explorationBudget;

  const { blockMs, quotas } = calculateBlockQuotas(sourceDurationMs, detailAnalysisBudget, densityBins);
  const blockUsage: number[] = new Array<number>(quotas.length).fill(0);

  // Normalize scores (0.0 to 1.0 safely)
  let maxScore = -Infinity;
  let minScore = Infinity;
  for (const c of reservoir) {
    if (c.score > maxScore) maxScore = c.score;
    if (c.score < minScore) minScore = c.score;
  }
  const scoreRange = maxScore - minScore || 1;

  interface Draft<T extends SelectableCandidate> {
    candidate: T;
    normalizedQuality: number;
    workingUtility: number;
    duplicateSimilarity: number;
    coveragePenalty: number;
    blockIndex: number;
    isRecommended: boolean;
  }

  const drafts: Draft<TCandidate>[] = reservoir.map(c => {
    const nq = (c.score - minScore) / scoreRange;
    return {
      candidate: c,
      normalizedQuality: nq,
      workingUtility: nq,
      duplicateSimilarity: 0,
      coveragePenalty: 0,
      blockIndex: clamp(Math.floor(c.peakMs / blockMs), 0, quotas.length - 1),
      isRecommended: recommendedCandidateIds.includes(c.id),
    };
  });

  const selected: TCandidate[] = [];
  const diagnostics: SelectionDiagnostics[] = [];

  const updateUtility = (draft: Draft<TCandidate>) => {
    // Quality vs Novelty
    const baseUtility = qualityLambda * draft.normalizedQuality + (1 - qualityLambda) * (1 - draft.duplicateSimilarity);
    
    // Coverage Soft Penalty (if block is over quota)
    const quota = quotas[draft.blockIndex]!;
    const usage = blockUsage[draft.blockIndex]!;
    // If usage >= quota, apply soft penalty proportional to overage
    draft.coveragePenalty = usage >= quota ? Math.pow(0.8, usage - quota + 1) : 1.0;
    
    // AI recommendation bonus
    const contextBonus = draft.isRecommended ? 0.1 : 0.0;

    draft.workingUtility = (baseUtility * draft.coveragePenalty) + contextBonus;
  };

  const selectPass = (budget: number, passName: "main" | "exploration") => {
    while (selected.length < budget && drafts.length > 0) {
      // Re-evaluate utilities
      for (const draft of drafts) {
        updateUtility(draft);
      }

      // Sort by workingUtility descending, tie breaks logic:
      drafts.sort((left, right) => {
        return (
          right.workingUtility - left.workingUtility ||
          right.normalizedQuality - left.normalizedQuality ||
          left.candidate.peakMs - right.candidate.peakMs ||
          left.candidate.id.localeCompare(right.candidate.id)
        );
      });

      const winner = drafts.shift();
      if (!winner) break;

      selected.push(winner.candidate);
      blockUsage[winner.blockIndex]!++;

      diagnostics.push({
        selectedCandidateId: winner.candidate.id,
        baseQuality: winner.normalizedQuality,
        duplicateSimilarity: winner.duplicateSimilarity,
        coveragePenalty: winner.coveragePenalty,
        finalUtility: winner.workingUtility,
        selectionPass: passName,
        blockIndex: winner.blockIndex,
      });

      // Update duplicate similarity for remaining drafts based on winner
      for (const draft of drafts) {
        const timeDiff = Math.abs(winner.candidate.peakMs - draft.candidate.peakMs);
        
        // Hard overlap checking
        const overlaps = Math.max(0, Math.min(winner.candidate.endMs, draft.candidate.endMs) - Math.max(winner.candidate.startMs, draft.candidate.startMs)) > 0;
        
        let sim;
        if (overlaps) {
          sim = 1.0; // Perfect duplicate
        } else {
          // Continuous decay around 90 seconds
          // temporalSimilarity = exp(-(deltaMs / 90_000)^2)
          sim = Math.exp(-Math.pow(timeDiff / 90_000, 2));
          // If event kind differs, it's a different event, so drop similarity heavily
          const winnerEventKind = (winner.candidate.evidence as { eventKind?: string } | undefined)?.eventKind;
          const draftEventKind = (draft.candidate.evidence as { eventKind?: string } | undefined)?.eventKind;
          if (winnerEventKind && draftEventKind && winnerEventKind !== draftEventKind) {
            sim *= 0.1;
          }
        }
        
        draft.duplicateSimilarity = Math.max(draft.duplicateSimilarity, sim);
      }
    }
  };

  selectPass(mainBudget, "main");
  
  // For exploration pass
  selectPass(detailAnalysisBudget, "exploration");

  // Sort final selected chronologically
  selected.sort((left, right) => left.peakMs - right.peakMs);

  return { candidates: selected, diagnostics };
}
