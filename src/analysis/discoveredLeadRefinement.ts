import type {
  BroadcastContextDiscoveredLead,
} from "./broadcastContextProtocol";
import type { BroadcastTranscriptQwenResult } from "./broadcastTranscriptQwen";
import { QWEN_ASR_FILETRANS_USD_PER_SECOND } from "./broadcastContextSamplingPlan";

export const DISCOVERED_LEAD_REFINEMENT_VERSION = "1.0.0" as const;
export const DISCOVERED_LEAD_REFINEMENT_BUDGET_USD = 0.03;
export const MAX_DISCOVERED_LEADS_TO_REFINE = 4;
export const REFINEMENT_SEGMENT_DURATION_MS = 70_000;
export const REFINED_CLIP_DURATION_MS = 45_000;

export interface DiscoveredLeadRefinementSegment {
  readonly segmentId: string;
  readonly leadId: string;
  readonly sourceStartMs: number;
  readonly sourceEndMs: number;
}

export interface DiscoveredLeadRefinementPlan {
  readonly version: typeof DISCOVERED_LEAD_REFINEMENT_VERSION;
  readonly selectedLeadIds: readonly string[];
  readonly segments: readonly DiscoveredLeadRefinementSegment[];
  readonly estimatedAsrCostUsd: number;
}

export interface RefinedDiscoveredLeadRange {
  readonly leadId: string;
  readonly startMs: number;
  readonly peakMs: number;
  readonly endMs: number;
  readonly transcriptMatchScore: number;
  readonly matchedSegmentId: string;
}

const MAX_REFINEMENT_AUDIO_MS = Math.floor(
  (DISCOVERED_LEAD_REFINEMENT_BUDGET_USD /
    QWEN_ASR_FILETRANS_USD_PER_SECOND) *
    1_000,
);

function boundedInspectionRange(
  lead: BroadcastContextDiscoveredLead,
  allocatedMs: number,
): { readonly startMs: number; readonly endMs: number } {
  const durationMs = lead.endMs - lead.startMs;
  if (durationMs <= allocatedMs) {
    return { startMs: lead.startMs, endMs: lead.endMs };
  }
  const midpointMs = lead.startMs + durationMs / 2;
  const startMs = Math.round(midpointMs - allocatedMs / 2);
  return { startMs, endMs: startMs + allocatedMs };
}

/**
 * Re-ASRs only a few context-discovered ranges in 70-second cells. This turns
 * a coarse 3.5-minute chapter lead into a bounded location before Gemini sees
 * the final 45-second audio/video candidate.
 */
export function createDiscoveredLeadRefinementPlan(
  leads: readonly BroadcastContextDiscoveredLead[],
): DiscoveredLeadRefinementPlan {
  const selected = [...leads]
    .filter(
      (lead) =>
        Number.isFinite(lead.confidence) &&
        lead.confidence >= 0.55 &&
        Number.isSafeInteger(lead.startMs) &&
        Number.isSafeInteger(lead.endMs) &&
        lead.startMs >= 0 &&
        lead.endMs > lead.startMs,
    )
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.startMs - right.startMs ||
        left.leadId.localeCompare(right.leadId),
    )
    .slice(0, MAX_DISCOVERED_LEADS_TO_REFINE);
  const perLeadBudgetMs =
    selected.length === 0
      ? 0
      : Math.floor(MAX_REFINEMENT_AUDIO_MS / selected.length);
  const segments: DiscoveredLeadRefinementSegment[] = [];

  for (const lead of selected) {
    const range = boundedInspectionRange(lead, perLeadBudgetMs);
    let sourceStartMs = range.startMs;
    while (sourceStartMs < range.endMs) {
      const sourceEndMs = Math.min(
        range.endMs,
        sourceStartMs + REFINEMENT_SEGMENT_DURATION_MS,
      );
      segments.push({
        segmentId: `refine-${String(segments.length + 1).padStart(3, "0")}`,
        leadId: lead.leadId,
        sourceStartMs,
        sourceEndMs,
      });
      sourceStartMs = sourceEndMs;
    }
  }
  const sampledMs = segments.reduce(
    (sum, segment) => sum + segment.sourceEndMs - segment.sourceStartMs,
    0,
  );
  return {
    version: DISCOVERED_LEAD_REFINEMENT_VERSION,
    selectedLeadIds: selected.map((lead) => lead.leadId),
    segments,
    estimatedAsrCostUsd:
      (sampledMs / 1_000) * QWEN_ASR_FILETRANS_USD_PER_SECOND,
  };
}

function normalizedTerms(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .normalize("NFKC")
        .toLocaleLowerCase("ko-KR")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/u)
        .map((term) => term.trim())
        .filter((term) => Array.from(term).length >= 2),
    ),
  ];
}

function transcriptMatchScore(cue: string, transcript: string): number {
  const cueTerms = normalizedTerms(cue);
  if (cueTerms.length === 0) return 0;
  const transcriptTerms = new Set(normalizedTerms(transcript));
  const matches = cueTerms.filter((term) => transcriptTerms.has(term)).length;
  return matches / cueTerms.length;
}

/** Selects one source-fenced ASR cell and expands it to a 45-second clip range. */
export function refineDiscoveredLeadRange(
  lead: BroadcastContextDiscoveredLead,
  plan: DiscoveredLeadRefinementPlan,
  transcripts: readonly BroadcastTranscriptQwenResult[],
  sourceDurationMs: number,
): RefinedDiscoveredLeadRange | null {
  const segmentByRange = new Map(
    plan.segments
      .filter((segment) => segment.leadId === lead.leadId)
      .map((segment) => [
        `${segment.sourceStartMs}:${segment.sourceEndMs}`,
        segment,
      ]),
  );
  const matches = transcripts
    .map((transcript) => ({
      transcript,
      segment: segmentByRange.get(
        `${transcript.sourceStartMs}:${transcript.sourceEndMs}`,
      ),
      score: transcriptMatchScore(lead.evidenceCueKo, transcript.textKo),
    }))
    .filter(
      (entry): entry is typeof entry & { segment: DiscoveredLeadRefinementSegment } =>
        entry.segment !== undefined,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.segment.sourceStartMs - right.segment.sourceStartMs,
    );
  const best = matches[0];
  if (best === undefined) return null;
  const peakMs = Math.round(
    best.segment.sourceStartMs +
      (best.segment.sourceEndMs - best.segment.sourceStartMs) / 2,
  );
  const unclampedStartMs = peakMs - Math.floor(REFINED_CLIP_DURATION_MS / 2);
  const startMs = Math.max(
    0,
    Math.min(sourceDurationMs - REFINED_CLIP_DURATION_MS, unclampedStartMs),
  );
  return {
    leadId: lead.leadId,
    startMs,
    peakMs,
    endMs: Math.min(sourceDurationMs, startMs + REFINED_CLIP_DURATION_MS),
    transcriptMatchScore: best.score,
    matchedSegmentId: best.segment.segmentId,
  };
}
