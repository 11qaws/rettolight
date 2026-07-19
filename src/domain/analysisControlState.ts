import type { AnalysisRunState } from "./analysisRun";

export type AnalysisRunStatus = AnalysisRunState["status"];

export type AnalysisControlStateInput = {
  readonly analysisStartPending: boolean;
  readonly analysisCommitPending: boolean;
  readonly analysisCancelPending: boolean;
  readonly runStatus: AnalysisRunStatus | null;
};

export type AnalysisControlState = {
  readonly analysisBusy: boolean;
  readonly analysisCanBeCancelled: boolean;
};

const BUSY_RUN_STATUSES: ReadonlySet<AnalysisRunStatus> = new Set([
  "starting",
  "running",
  "pausing",
  "resuming",
  "finalizing",
  "completing",
  "cancelling",
  "failing",
]);

const CANCELLABLE_RUN_STATUSES: ReadonlySet<AnalysisRunStatus> = new Set([
  "starting",
  "running",
]);

export function deriveAnalysisControlState({
  analysisStartPending,
  analysisCommitPending,
  analysisCancelPending,
  runStatus,
}: AnalysisControlStateInput): AnalysisControlState {
  const analysisBusy =
    analysisStartPending ||
    analysisCancelPending ||
    analysisCommitPending ||
    (runStatus !== null && BUSY_RUN_STATUSES.has(runStatus));

  const analysisCanBeCancelled =
    !analysisCommitPending &&
    !analysisCancelPending &&
    ((runStatus === null && analysisStartPending) ||
      (runStatus !== null && CANCELLABLE_RUN_STATUSES.has(runStatus)));

  return {
    analysisBusy,
    analysisCanBeCancelled,
  };
}
