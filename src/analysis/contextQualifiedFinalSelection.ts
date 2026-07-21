import {
  buildBroadcastContextEligibilityById,
  type BroadcastContextCandidateAnnotation,
} from "./broadcastContextProtocol";
import type { SelectableCandidate } from "./contextAwareCandidateSelection";

export interface ContextQualifiedFinalSelection<
  TCandidate extends SelectableCandidate = SelectableCandidate,
> {
  readonly selectedCandidates: readonly TCandidate[];
  readonly reviewCandidates: readonly TCandidate[];
  readonly rejectedCandidateIds: readonly string[];
  readonly missingContextCandidateIds: readonly string[];
  readonly eligibilityById: Readonly<
    Record<string, "eligible" | "exploration" | "ineligible">
  >;
}

/**
 * Applies the whole-broadcast semantic verdict after candidate perception.
 * Missing context is review-only; it can never silently become an approved clip.
 */
export function finalizeContextQualifiedCandidates<
  TCandidate extends SelectableCandidate,
>(
  candidates: readonly TCandidate[],
  annotations: readonly BroadcastContextCandidateAnnotation[],
): ContextQualifiedFinalSelection<TCandidate> {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const annotationById = new Map<string, BroadcastContextCandidateAnnotation>();
  for (const annotation of annotations) {
    if (!candidateIds.has(annotation.candidateId)) continue;
    if (annotationById.has(annotation.candidateId)) {
      throw new RangeError("Broadcast context contains a duplicate candidate annotation.");
    }
    annotationById.set(annotation.candidateId, annotation);
  }

  const eligibilityById = {
    ...buildBroadcastContextEligibilityById([...annotationById.values()]),
  };
  const selectedCandidates: TCandidate[] = [];
  const reviewCandidates: TCandidate[] = [];
  const rejectedCandidateIds: string[] = [];
  const missingContextCandidateIds: string[] = [];

  for (const candidate of candidates) {
    const annotation = annotationById.get(candidate.id);
    if (annotation === undefined) {
      eligibilityById[candidate.id] = "exploration";
      reviewCandidates.push(candidate);
      missingContextCandidateIds.push(candidate.id);
      continue;
    }
    if (annotation.clipDecision === "select") {
      selectedCandidates.push(candidate);
    } else if (annotation.clipDecision === "review") {
      reviewCandidates.push(candidate);
    } else {
      rejectedCandidateIds.push(candidate.id);
    }
  }

  const chronological = (left: TCandidate, right: TCandidate): number =>
    left.peakMs - right.peakMs || left.id.localeCompare(right.id);
  selectedCandidates.sort(chronological);
  reviewCandidates.sort(chronological);
  rejectedCandidateIds.sort((left, right) => left.localeCompare(right));
  missingContextCandidateIds.sort((left, right) => left.localeCompare(right));

  return {
    selectedCandidates,
    reviewCandidates,
    rejectedCandidateIds,
    missingContextCandidateIds,
    eligibilityById,
  };
}
