/// <reference lib="webworker" />

import { selectChatHighlights } from "./highlightSelector";
import type {
  ChatAnalysisWorkerRequest,
  ChatAnalysisWorkerResponse,
} from "./chatAnalysisWorkerProtocol";

declare const self: DedicatedWorkerGlobalScope;

function createEventId(taskId: string): string {
  const randomId = self.crypto?.randomUUID?.();
  return `${taskId}-${randomId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

self.addEventListener("message", (event: MessageEvent<ChatAnalysisWorkerRequest>) => {
  const request = event.data;
  if (request.type !== "analyze-chat-signals") {
    return;
  }

  const envelope = {
    ...request.identity,
    eventId: createEventId(request.identity.taskId),
  };

  try {
    const result = selectChatHighlights(request.messages, request.options);
    const response: ChatAnalysisWorkerResponse = {
      ...envelope,
      type: "chat-signals-completed",
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ChatAnalysisWorkerResponse = {
      ...envelope,
      type: "chat-signals-failed",
      reasonCode: "SIGNAL_ENGINE_FAILED",
      message: error instanceof Error ? error.message : "Unknown chat signal failure",
    };
    self.postMessage(response);
  }
});

export {};
