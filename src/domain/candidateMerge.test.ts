import { describe, expect, it } from "vitest";

import {
  mergeCandidateProposal,
  type CandidateMergeContext,
  type CandidateProposal,
  type Segment,
} from "./candidateMerge";

const defaultContext: CandidateMergeContext = {
  isEditing: false,
  isPinned: false,
  allowedAnalysisRunIds: new Set(["run-1"]),
};

const makeSegment = (overrides: Partial<Segment> = {}): Segment => ({
  id: "segment-1",
  recordState: "active",
  reviewState: "unreviewed",
  userRevision: 0,
  range: { startMs: 100_000, endMs: 145_000 },
  title: "빠른 분석 제목",
  note: "사용자 메모",
  tags: ["웃음"],
  fieldOwners: { range: "ai", title: "ai" },
  updatedAt: "2026-07-19T00:00:00.000Z",
  ...overrides,
});

const makeProposal = (
  overrides: Partial<CandidateProposal> = {},
): CandidateProposal => ({
  proposalId: "proposal-2",
  segmentId: "segment-1",
  analysisRunId: "run-1",
  proposalRevision: 2,
  basedOnUserRevision: 0,
  suggestedRange: { startMs: 94_000, endMs: 151_000 },
  suggestedTitle: "정밀 분석 제목",
  createdAt: "2026-07-19T00:05:00.000Z",
  ...overrides,
});

describe("candidate proposal merge policy", () => {
  it("auto-applies a current proposal only to unreviewed AI-owned fields", () => {
    const segment = makeSegment();
    const result = mergeCandidateProposal(
      segment,
      makeProposal(),
      defaultContext,
    );

    expect(result.mode).toBe("autoApplied");
    expect(result.segment).toMatchObject({
      range: { startMs: 94_000, endMs: 151_000 },
      title: "정밀 분석 제목",
      userRevision: 0,
      reviewState: "unreviewed",
      adoptedProposalId: "proposal-2",
    });
    expect(segment.range).toEqual({ startMs: 100_000, endMs: 145_000 });
  });

  it("preserves a user-owned range while allowing the still-AI-owned title", () => {
    const segment = makeSegment({
      userRevision: 1,
      range: { startMs: 97_000, endMs: 145_000 },
      fieldOwners: { range: "user", title: "ai" },
    });
    const result = mergeCandidateProposal(
      segment,
      makeProposal({ basedOnUserRevision: 1 }),
      defaultContext,
    );

    expect(result.mode).toBe("partiallyApplied");
    expect(result.segment.range).toEqual({ startMs: 97_000, endMs: 145_000 });
    expect(result.segment.title).toBe("정밀 분석 제목");
    expect(result.fields.range).toMatchObject({
      accepted: false,
      mode: "compareOnly",
      reason: "field_owned_by_user",
    });
  });

  it("returns compare-only and preserves all user values on revision mismatch", () => {
    const segment = makeSegment({
      userRevision: 2,
      range: { startMs: 98_000, endMs: 146_000 },
      title: "사람이 쓴 제목",
      fieldOwners: { range: "user", title: "user" },
    });
    const result = mergeCandidateProposal(
      segment,
      makeProposal({ basedOnUserRevision: 1 }),
      defaultContext,
    );

    expect(result.mode).toBe("compareOnly");
    expect(result.segment).toBe(segment);
    expect(result.fields.range).toMatchObject({
      accepted: false,
      reason: "user_revision_mismatch",
    });
    expect(result.fields.title).toMatchObject({
      accepted: false,
      reason: "user_revision_mismatch",
    });
  });

  it.each([
    [
      "an open editor",
      makeSegment(),
      { ...defaultContext, isEditing: true },
      "user_is_editing",
    ],
    [
      "a pinned proposal",
      makeSegment(),
      { ...defaultContext, isPinned: true },
      "proposal_is_pinned",
    ],
    [
      "a rejected segment",
      makeSegment({ reviewState: "rejected" }),
      defaultContext,
      "segment_rejected",
    ],
    [
      "a trashed segment",
      makeSegment({ recordState: "trashed" }),
      defaultContext,
      "segment_trashed",
    ],
    [
      "an approved segment",
      makeSegment({ reviewState: "approved", approvedRevision: 0 }),
      defaultContext,
      "review_state_not_unreviewed",
    ],
  ] as const)(
    "never auto-applies over %s",
    (_label, segment, context, reason) => {
      const result = mergeCandidateProposal(
        segment,
        makeProposal(),
        context,
      );

      expect(result.mode).toBe("compareOnly");
      expect(result.segment).toBe(segment);
      expect(result.fields.range).toMatchObject({ accepted: false, reason });
      expect(result.fields.title).toMatchObject({ accepted: false, reason });
    },
  );

  it("rejects proposals from an analysis lineage that is not allowed", () => {
    const segment = makeSegment();
    const result = mergeCandidateProposal(segment, makeProposal(), {
      ...defaultContext,
      allowedAnalysisRunIds: new Set(["run-2"]),
    });

    expect(result.mode).toBe("compareOnly");
    expect(result.segment).toBe(segment);
    expect(result.fields.range).toMatchObject({
      accepted: false,
      reason: "analysis_run_not_allowed",
    });
  });

  it("never changes reviewState, userRevision, notes, or tags", () => {
    const segment = makeSegment({
      note: "비공개 메모",
      tags: ["보존", "사람"],
    });
    const result = mergeCandidateProposal(
      segment,
      makeProposal(),
      defaultContext,
    );

    expect(result.segment.reviewState).toBe(segment.reviewState);
    expect(result.segment.userRevision).toBe(segment.userRevision);
    expect(result.segment.note).toBe(segment.note);
    expect(result.segment.tags).toBe(segment.tags);
  });
});
