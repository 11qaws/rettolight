export type EventFenceState = {
  readonly sessionId: string;
  readonly writerEpoch: number;
  readonly runId: string;
  readonly workerEpoch: number;
  readonly workerInstanceId: string;
  readonly taskId: string;
  readonly processedEventIds: ReadonlySet<string>;
};

export type FenceableEvent = {
  readonly eventId: string;
  readonly sessionId: string;
  readonly writerEpoch: number;
  readonly runId: string;
  readonly workerEpoch: number;
  readonly workerInstanceId: string;
  readonly taskId: string;
};

export type EventFenceRejectionReason =
  | "invalid_event_id"
  | "session_id_mismatch"
  | "writer_epoch_mismatch"
  | "run_id_mismatch"
  | "worker_epoch_mismatch"
  | "worker_instance_id_mismatch"
  | "task_id_mismatch"
  | "duplicate_event_id";

export type EventFenceOutcome =
  | { readonly accepted: true; readonly state: EventFenceState }
  | {
      readonly accepted: false;
      readonly state: EventFenceState;
      readonly reason: EventFenceRejectionReason;
    };

export type CreateEventFenceInput = Omit<
  EventFenceState,
  "processedEventIds"
> & {
  readonly processedEventIds?: ReadonlySet<string>;
};

export function createEventFence(input: CreateEventFenceInput): EventFenceState {
  return {
    sessionId: input.sessionId,
    writerEpoch: input.writerEpoch,
    runId: input.runId,
    workerEpoch: input.workerEpoch,
    workerInstanceId: input.workerInstanceId,
    taskId: input.taskId,
    processedEventIds: new Set(input.processedEventIds ?? []),
  };
}

function reject(
  state: EventFenceState,
  reason: EventFenceRejectionReason,
): EventFenceOutcome {
  return { accepted: false, state, reason };
}

/**
 * Applies the canonical identity fence in a deterministic order and records the
 * event ID only after every identity check succeeds.
 */
export function fenceEvent(
  state: EventFenceState,
  event: FenceableEvent,
): EventFenceOutcome {
  if (typeof event.eventId !== "string" || event.eventId.trim().length === 0) {
    return reject(state, "invalid_event_id");
  }
  if (event.sessionId !== state.sessionId) {
    return reject(state, "session_id_mismatch");
  }
  if (event.writerEpoch !== state.writerEpoch) {
    return reject(state, "writer_epoch_mismatch");
  }
  if (event.runId !== state.runId) {
    return reject(state, "run_id_mismatch");
  }
  if (event.workerEpoch !== state.workerEpoch) {
    return reject(state, "worker_epoch_mismatch");
  }
  if (event.workerInstanceId !== state.workerInstanceId) {
    return reject(state, "worker_instance_id_mismatch");
  }
  if (event.taskId !== state.taskId) {
    return reject(state, "task_id_mismatch");
  }
  if (state.processedEventIds.has(event.eventId)) {
    return reject(state, "duplicate_event_id");
  }

  const processedEventIds = new Set(state.processedEventIds);
  processedEventIds.add(event.eventId);

  return {
    accepted: true,
    state: { ...state, processedEventIds },
  };
}
