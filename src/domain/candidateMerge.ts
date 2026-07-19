export type TimeRange = {
  readonly startMs: number;
  readonly endMs: number;
};

export type SegmentReviewState =
  | "unreviewed"
  | "inReview"
  | "approved"
  | "rejected"
  | "needsWork";

export type Segment = {
  readonly id: string;
  readonly recordState: "active" | "trashed";
  readonly reviewState: SegmentReviewState;
  readonly userRevision: number;
  readonly range: TimeRange;
  readonly title: string;
  readonly note: string;
  readonly tags: readonly string[];
  readonly fieldOwners: {
    readonly range: "ai" | "user";
    readonly title: "ai" | "user";
  };
  readonly adoptedProposalId?: string;
  readonly approvedRevision?: number;
  readonly updatedAt: string;
};

export type CandidateProposal = {
  readonly proposalId: string;
  readonly segmentId: string;
  readonly analysisRunId: string;
  readonly proposalRevision: number;
  readonly basedOnUserRevision: number;
  readonly suggestedRange: TimeRange;
  readonly suggestedTitle: string;
  readonly createdAt: string;
};

export type CandidateMergeContext = {
  readonly isEditing: boolean;
  readonly isPinned: boolean;
  readonly allowedAnalysisRunIds: ReadonlySet<string>;
};

export type CandidateField = "range" | "title";

export type CandidateCompareOnlyReason =
  | "segment_id_mismatch"
  | "segment_trashed"
  | "segment_rejected"
  | "review_state_not_unreviewed"
  | "user_is_editing"
  | "proposal_is_pinned"
  | "analysis_run_not_allowed"
  | "user_revision_mismatch"
  | "field_owned_by_user"
  | "invalid_suggested_range"
  | "invalid_suggested_title";

export type CandidateFieldMergeOutcome =
  | {
      readonly accepted: true;
      readonly mode: "autoApplied";
      readonly field: CandidateField;
      readonly segment: Segment;
    }
  | {
      readonly accepted: false;
      readonly mode: "compareOnly";
      readonly field: CandidateField;
      readonly segment: Segment;
      readonly reason: CandidateCompareOnlyReason;
    };

export type CandidateProposalMergeOutcome = {
  readonly mode: "autoApplied" | "partiallyApplied" | "compareOnly";
  readonly segment: Segment;
  readonly fields: {
    readonly range: CandidateFieldMergeOutcome;
    readonly title: CandidateFieldMergeOutcome;
  };
};

function compareOnly(
  segment: Segment,
  field: CandidateField,
  reason: CandidateCompareOnlyReason,
): CandidateFieldMergeOutcome {
  return { accepted: false, mode: "compareOnly", field, segment, reason };
}

function globalCompareOnlyReason(
  segment: Segment,
  proposal: CandidateProposal,
  context: CandidateMergeContext,
): CandidateCompareOnlyReason | null {
  if (proposal.segmentId !== segment.id) {
    return "segment_id_mismatch";
  }
  if (segment.recordState === "trashed") {
    return "segment_trashed";
  }
  if (segment.reviewState === "rejected") {
    return "segment_rejected";
  }
  if (segment.reviewState !== "unreviewed") {
    return "review_state_not_unreviewed";
  }
  if (context.isEditing) {
    return "user_is_editing";
  }
  if (context.isPinned) {
    return "proposal_is_pinned";
  }
  if (!context.allowedAnalysisRunIds.has(proposal.analysisRunId)) {
    return "analysis_run_not_allowed";
  }
  if (proposal.basedOnUserRevision !== segment.userRevision) {
    return "user_revision_mismatch";
  }
  return null;
}

function isValidRange(range: TimeRange): boolean {
  return (
    Number.isInteger(range.startMs) &&
    Number.isInteger(range.endMs) &&
    range.startMs >= 0 &&
    range.startMs <= range.endMs
  );
}

/**
 * Merges one AI-owned display field. A blocked field is never changed and is
 * returned as a compare-only proposal for explicit user adoption.
 */
export function mergeCandidateField(
  segment: Segment,
  proposal: CandidateProposal,
  field: CandidateField,
  context: CandidateMergeContext,
): CandidateFieldMergeOutcome {
  const globalReason = globalCompareOnlyReason(segment, proposal, context);
  if (globalReason !== null) {
    return compareOnly(segment, field, globalReason);
  }

  if (segment.fieldOwners[field] !== "ai") {
    return compareOnly(segment, field, "field_owned_by_user");
  }

  if (field === "range") {
    if (!isValidRange(proposal.suggestedRange)) {
      return compareOnly(segment, field, "invalid_suggested_range");
    }
    return {
      accepted: true,
      mode: "autoApplied",
      field,
      segment: {
        ...segment,
        range: { ...proposal.suggestedRange },
        adoptedProposalId: proposal.proposalId,
        updatedAt: proposal.createdAt,
      },
    };
  }

  if (proposal.suggestedTitle.trim().length === 0) {
    return compareOnly(segment, field, "invalid_suggested_title");
  }
  return {
    accepted: true,
    mode: "autoApplied",
    field,
    segment: {
      ...segment,
      title: proposal.suggestedTitle,
      adoptedProposalId: proposal.proposalId,
      updatedAt: proposal.createdAt,
    },
  };
}

/** Applies range and title independently so a user-owned field is preserved. */
export function mergeCandidateProposal(
  segment: Segment,
  proposal: CandidateProposal,
  context: CandidateMergeContext,
): CandidateProposalMergeOutcome {
  const range = mergeCandidateField(segment, proposal, "range", context);
  const afterRange = range.accepted ? range.segment : segment;
  const title = mergeCandidateField(afterRange, proposal, "title", context);
  const appliedCount = Number(range.accepted) + Number(title.accepted);

  return {
    mode:
      appliedCount === 2
        ? "autoApplied"
        : appliedCount === 1
          ? "partiallyApplied"
          : "compareOnly",
    segment: title.accepted ? title.segment : afterRange,
    fields: { range, title },
  };
}
