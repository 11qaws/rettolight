import { describe, expect, it } from "vitest";

import {
  createSourceCheck,
  reduceSourceCheck,
  type SourceCheckResultKind,
  type SourceCheckState,
} from "./sourceCheck";

const makeCreated = (jobId = "check-1"): SourceCheckState =>
  createSourceCheck({
    jobId,
    sourceDefinitionId: "source-1",
    bindingRevision: 3,
  });

function expectAccepted(
  outcome: ReturnType<typeof reduceSourceCheck>,
): SourceCheckState {
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) {
    throw new Error(`Expected accepted transition, got ${outcome.reason}`);
  }
  return outcome.state;
}

function completeWith(resultKind: SourceCheckResultKind): SourceCheckState {
  let state = expectAccepted(
    reduceSourceCheck(makeCreated(), { type: "CHECK_START_REQUESTED" }),
  );
  state = expectAccepted(
    reduceSourceCheck(state, {
      type: "PROBES_FINISHED",
      resultKind,
      capabilityDraftId: "draft-1",
    }),
  );
  return expectAccepted(
    reduceSourceCheck(state, {
      type: "CAPABILITY_SNAPSHOT_COMMITTED",
      capabilitySnapshotId: "snapshot-1",
    }),
  );
}

describe("SourceCheck reducer", () => {
  it.each<SourceCheckResultKind>(["ready", "degraded", "blocked"])(
    "completes normally with resultKind %s without turning the result into lifecycle status",
    (resultKind) => {
      const state = completeWith(resultKind);

      expect(state.status).toBe("completed");
      if (state.status === "completed") {
        expect(state.resultKind).toBe(resultKind);
        expect(state.capabilitySnapshotId).toBe("snapshot-1");
      }
    },
  );

  it("does not treat a blocked capability result as a failed check", () => {
    const state = completeWith("blocked");
    expect(state.status).toBe("completed");
  });

  it("requires probe stop confirmation before cancellation is terminal", () => {
    let state = expectAccepted(
      reduceSourceCheck(makeCreated(), { type: "CHECK_START_REQUESTED" }),
    );
    state = expectAccepted(
      reduceSourceCheck(state, { type: "CANCEL_REQUESTED" }),
    );
    expect(state.status).toBe("cancelling");

    const premature = reduceSourceCheck(state, {
      type: "CAPABILITY_SNAPSHOT_COMMITTED",
      capabilitySnapshotId: "snapshot-1",
    });
    expect(premature).toMatchObject({
      accepted: false,
      reason: "undefined_transition",
    });

    state = expectAccepted(reduceSourceCheck(state, { type: "PROBES_STOPPED" }));
    expect(state.status).toBe("cancelled");
  });

  it("rejects undefined transitions without changing state", () => {
    const state = makeCreated();
    const outcome = reduceSourceCheck(state, {
      type: "PROBE_PROGRESS",
      probeId: "metadata",
    });

    expect(outcome).toEqual({
      accepted: false,
      state,
      reason: "undefined_transition",
    });
  });

  it("makes every terminal SourceCheck absorbing", () => {
    const terminalStates: SourceCheckState[] = [
      completeWith("ready"),
      { ...makeCreated("cancelled"), status: "cancelled" },
      {
        ...makeCreated("failed"),
        status: "failed",
        reasonCode: "source_samples_unreadable",
      },
      {
        ...makeCreated("interrupted"),
        status: "interrupted",
        reasonCode: "session_lost",
      },
    ];

    for (const state of terminalStates) {
      const outcome = reduceSourceCheck(state, {
        type: "CHECK_START_REQUESTED",
      });
      expect(outcome).toEqual({
        accepted: false,
        state,
        reason: "terminal_state_absorbing",
      });
    }
  });

  it("distinguishes fatal failure from session interruption", () => {
    const checking = expectAccepted(
      reduceSourceCheck(makeCreated(), { type: "CHECK_START_REQUESTED" }),
    );
    const failed = expectAccepted(
      reduceSourceCheck(checking, {
        type: "CHECK_FATAL",
        reasonCode: "source_samples_unreadable",
      }),
    );
    const interrupted = expectAccepted(
      reduceSourceCheck(checking, { type: "SESSION_LOST" }),
    );

    expect(failed.status).toBe("failed");
    expect(interrupted.status).toBe("interrupted");
  });
});
