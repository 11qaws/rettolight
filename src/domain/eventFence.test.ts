import { describe, expect, it } from "vitest";

import {
  createEventFence,
  fenceEvent,
  type EventFenceRejectionReason,
  type FenceableEvent,
} from "./eventFence";

const validEvent: FenceableEvent = {
  eventId: "event-1",
  sessionId: "session-1",
  writerEpoch: 7,
  runId: "run-1",
  workerEpoch: 3,
  workerInstanceId: "worker-3",
  taskId: "task-9",
};

const makeFence = () =>
  createEventFence({
    sessionId: "session-1",
    writerEpoch: 7,
    runId: "run-1",
    workerEpoch: 3,
    workerInstanceId: "worker-3",
    taskId: "task-9",
  });

describe("event fence", () => {
  it("accepts a matching event exactly once without mutating the input fence", () => {
    const state = makeFence();
    const accepted = fenceEvent(state, validEvent);

    expect(accepted.accepted).toBe(true);
    expect(state.processedEventIds.size).toBe(0);
    if (!accepted.accepted) {
      throw new Error(`Expected accepted event, got ${accepted.reason}`);
    }
    expect(accepted.state.processedEventIds.has("event-1")).toBe(true);

    const duplicate = fenceEvent(accepted.state, validEvent);
    expect(duplicate).toMatchObject({
      accepted: false,
      reason: "duplicate_event_id",
    });
    expect(duplicate.state.processedEventIds.size).toBe(1);
  });

  it.each<
    [
      keyof Pick<
        FenceableEvent,
        | "sessionId"
        | "writerEpoch"
        | "runId"
        | "workerEpoch"
        | "workerInstanceId"
        | "taskId"
      >,
      string | number,
      EventFenceRejectionReason,
    ]
  >([
    ["sessionId", "stale-session", "session_id_mismatch"],
    ["writerEpoch", 6, "writer_epoch_mismatch"],
    ["runId", "old-run", "run_id_mismatch"],
    ["workerEpoch", 2, "worker_epoch_mismatch"],
    ["workerInstanceId", "old-worker", "worker_instance_id_mismatch"],
    ["taskId", "old-task", "task_id_mismatch"],
  ])("rejects stale %s without recording its eventId", (field, value, reason) => {
    const state = makeFence();
    const event = { ...validEvent, [field]: value };
    const outcome = fenceEvent(state, event);

    expect(outcome).toEqual({ accepted: false, state, reason });
    expect(state.processedEventIds.size).toBe(0);
  });

  it("rejects an empty eventId before it can enter the dedupe set", () => {
    const state = makeFence();
    const outcome = fenceEvent(state, { ...validEvent, eventId: "  " });

    expect(outcome).toEqual({
      accepted: false,
      state,
      reason: "invalid_event_id",
    });
  });
});
