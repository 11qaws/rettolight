import { describe, expect, it } from "vitest";

import {
  deriveAnalysisControlState,
  type AnalysisControlStateInput,
  type AnalysisRunStatus,
} from "./analysisControlState";

const idleInput = (): AnalysisControlStateInput => ({
  analysisStartPending: false,
  analysisCommitPending: false,
  analysisCancelPending: false,
  runStatus: null,
});

describe("analysis control UI state", () => {
  it("keeps idle controls inactive", () => {
    expect(deriveAnalysisControlState(idleInput())).toEqual({
      analysisBusy: false,
      analysisCanBeCancelled: false,
    });
  });

  it("is busy and cancellable while the start request is pending", () => {
    expect(
      deriveAnalysisControlState({
        ...idleInput(),
        analysisStartPending: true,
      }),
    ).toEqual({
      analysisBusy: true,
      analysisCanBeCancelled: true,
    });
  });

  it.each<AnalysisRunStatus>(["starting", "running"])(
    "is busy and cancellable in %s",
    (runStatus) => {
      expect(
        deriveAnalysisControlState({ ...idleInput(), runStatus }),
      ).toEqual({
        analysisBusy: true,
        analysisCanBeCancelled: true,
      });
    },
  );

  it("suppresses a second cancel action as soon as the first click is pending", () => {
    expect(
      deriveAnalysisControlState({
        ...idleInput(),
        analysisCancelPending: true,
        runStatus: "running",
      }),
    ).toEqual({
      analysisBusy: true,
      analysisCanBeCancelled: false,
    });
  });

  it("stays busy but not cancellable after the run enters cancelling", () => {
    expect(
      deriveAnalysisControlState({
        ...idleInput(),
        runStatus: "cancelling",
      }),
    ).toEqual({
      analysisBusy: true,
      analysisCanBeCancelled: false,
    });
  });

  it.each<AnalysisRunStatus>(["finalizing", "completing"])(
    "keeps the %s commit phase busy and non-cancellable",
    (runStatus) => {
      expect(
        deriveAnalysisControlState({
          ...idleInput(),
          analysisStartPending: true,
          analysisCommitPending: true,
          runStatus,
        }),
      ).toEqual({
        analysisBusy: true,
        analysisCanBeCancelled: false,
      });
    },
  );

  it.each<AnalysisRunStatus>(["pausing", "resuming", "failing"])(
    "keeps transitional status %s busy without offering cancellation",
    (runStatus) => {
      expect(
        deriveAnalysisControlState({ ...idleInput(), runStatus }),
      ).toEqual({
        analysisBusy: true,
        analysisCanBeCancelled: false,
      });
    },
  );

  it.each<AnalysisRunStatus>(["finalizing", "completing", "cancelling", "failing"])(
    "lets non-cancellable run status %s override the still-pending outer operation",
    (runStatus) => {
      expect(
        deriveAnalysisControlState({
          ...idleInput(),
          analysisStartPending: true,
          runStatus,
        }),
      ).toEqual({
        analysisBusy: true,
        analysisCanBeCancelled: false,
      });
    },
  );

  it.each<AnalysisRunStatus>([
    "created",
    "paused",
    "awaitingGapDecision",
    "completed",
    "completedWithGaps",
    "cancelled",
    "failed",
    "interrupted",
  ])("treats settled status %s as neither busy nor cancellable", (runStatus) => {
    expect(
      deriveAnalysisControlState({ ...idleInput(), runStatus }),
    ).toEqual({
      analysisBusy: false,
      analysisCanBeCancelled: false,
    });
  });
});
