export type SourceCheckResultKind = "ready" | "degraded" | "blocked";

type SourceCheckBase = {
  readonly jobId: string;
  readonly sourceDefinitionId: string;
  readonly bindingRevision: number;
};

export type SourceCheckState =
  | (SourceCheckBase & { readonly status: "created" })
  | (SourceCheckBase & {
      readonly status: "checking";
      readonly lastCompletedProbe: string | null;
    })
  | (SourceCheckBase & {
      readonly status: "committing";
      readonly resultKind: SourceCheckResultKind;
      readonly capabilityDraftId: string;
    })
  | (SourceCheckBase & {
      readonly status: "completed";
      readonly resultKind: SourceCheckResultKind;
      readonly capabilitySnapshotId: string;
    })
  | (SourceCheckBase & {
      readonly status: "cancelling";
      readonly abortRequested: true;
    })
  | (SourceCheckBase & { readonly status: "cancelled" })
  | (SourceCheckBase & {
      readonly status: "failed";
      readonly reasonCode: string;
    })
  | (SourceCheckBase & {
      readonly status: "interrupted";
      readonly reasonCode: "session_lost";
    });

export type SourceCheckEvent =
  | { readonly type: "CHECK_START_REQUESTED" }
  | { readonly type: "PROBE_PROGRESS"; readonly probeId: string }
  | {
      readonly type: "PROBES_FINISHED";
      readonly resultKind: SourceCheckResultKind;
      readonly capabilityDraftId: string;
    }
  | {
      readonly type: "CAPABILITY_SNAPSHOT_COMMITTED";
      readonly capabilitySnapshotId: string;
    }
  | { readonly type: "CANCEL_REQUESTED" }
  | { readonly type: "PROBES_STOPPED" }
  | { readonly type: "CHECK_FATAL"; readonly reasonCode: string }
  | { readonly type: "SESSION_LOST" };

export type SourceCheckRejectionReason =
  | "terminal_state_absorbing"
  | "undefined_transition"
  | "invalid_probe_id"
  | "invalid_capability_draft_id"
  | "invalid_capability_snapshot_id"
  | "missing_reason_code";

export type SourceCheckTransitionOutcome =
  | { readonly accepted: true; readonly state: SourceCheckState }
  | {
      readonly accepted: false;
      readonly state: SourceCheckState;
      readonly reason: SourceCheckRejectionReason;
    };

const TERMINAL_SOURCE_CHECK_STATUSES = new Set<SourceCheckState["status"]>([
  "completed",
  "cancelled",
  "failed",
  "interrupted",
]);

export function createSourceCheck(input: SourceCheckBase): SourceCheckState {
  return { ...input, status: "created" };
}

export function isSourceCheckTerminal(state: SourceCheckState): boolean {
  return TERMINAL_SOURCE_CHECK_STATUSES.has(state.status);
}

function baseOf(state: SourceCheckState): SourceCheckBase {
  return {
    jobId: state.jobId,
    sourceDefinitionId: state.sourceDefinitionId,
    bindingRevision: state.bindingRevision,
  };
}

function accept(state: SourceCheckState): SourceCheckTransitionOutcome {
  return { accepted: true, state };
}

function reject(
  state: SourceCheckState,
  reason: SourceCheckRejectionReason,
): SourceCheckTransitionOutcome {
  return { accepted: false, state, reason };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled SourceCheck state: ${JSON.stringify(value)}`);
}

/**
 * Pure reducer for exactly one SourceCheck attempt.
 *
 * Retrying creates a new SourceCheck with a new jobId through createSourceCheck;
 * terminal attempts are never resurrected by this reducer.
 */
export function reduceSourceCheck(
  state: SourceCheckState,
  event: SourceCheckEvent,
): SourceCheckTransitionOutcome {
  if (isSourceCheckTerminal(state)) {
    return reject(state, "terminal_state_absorbing");
  }

  if (event.type === "SESSION_LOST") {
    return accept({
      ...baseOf(state),
      status: "interrupted",
      reasonCode: "session_lost",
    });
  }

  if (
    event.type === "CANCEL_REQUESTED" &&
    (state.status === "created" || state.status === "checking")
  ) {
    return accept({
      ...baseOf(state),
      status: "cancelling",
      abortRequested: true,
    });
  }

  if (
    event.type === "CHECK_FATAL" &&
    (state.status === "checking" || state.status === "committing")
  ) {
    if (event.reasonCode.trim().length === 0) {
      return reject(state, "missing_reason_code");
    }

    return accept({
      ...baseOf(state),
      status: "failed",
      reasonCode: event.reasonCode,
    });
  }

  switch (state.status) {
    case "created":
      if (event.type === "CHECK_START_REQUESTED") {
        return accept({
          ...baseOf(state),
          status: "checking",
          lastCompletedProbe: null,
        });
      }
      return reject(state, "undefined_transition");

    case "checking":
      if (event.type === "PROBE_PROGRESS") {
        if (event.probeId.trim().length === 0) {
          return reject(state, "invalid_probe_id");
        }
        return accept({ ...state, lastCompletedProbe: event.probeId });
      }

      if (event.type === "PROBES_FINISHED") {
        if (event.capabilityDraftId.trim().length === 0) {
          return reject(state, "invalid_capability_draft_id");
        }
        return accept({
          ...baseOf(state),
          status: "committing",
          resultKind: event.resultKind,
          capabilityDraftId: event.capabilityDraftId,
        });
      }
      return reject(state, "undefined_transition");

    case "committing":
      if (event.type === "CAPABILITY_SNAPSHOT_COMMITTED") {
        if (event.capabilitySnapshotId.trim().length === 0) {
          return reject(state, "invalid_capability_snapshot_id");
        }
        return accept({
          ...baseOf(state),
          status: "completed",
          resultKind: state.resultKind,
          capabilitySnapshotId: event.capabilitySnapshotId,
        });
      }
      return reject(state, "undefined_transition");

    case "cancelling":
      if (event.type === "PROBES_STOPPED") {
        return accept({ ...baseOf(state), status: "cancelled" });
      }
      return reject(state, "undefined_transition");

    case "completed":
    case "cancelled":
    case "failed":
    case "interrupted":
      return reject(state, "terminal_state_absorbing");

    default:
      return assertNever(state);
  }
}
