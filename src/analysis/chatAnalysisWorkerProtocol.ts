import type { FenceableEvent } from "../domain/eventFence";
import type { NormalizedChatMessage } from "./chatImport";
import type {
  HighlightSelectionOptions,
  HighlightSelectionResult,
} from "./highlightSelector";

export type ChatAnalysisWorkerIdentity = Omit<FenceableEvent, "eventId">;

export interface ChatAnalysisWorkerRequest {
  readonly type: "analyze-chat-signals";
  readonly identity: ChatAnalysisWorkerIdentity;
  readonly messages: readonly NormalizedChatMessage[];
  readonly options: HighlightSelectionOptions;
}

export type ChatAnalysisWorkerResponse =
  | (FenceableEvent & {
      readonly type: "chat-signals-completed";
      readonly result: HighlightSelectionResult;
    })
  | (FenceableEvent & {
      readonly type: "chat-signals-failed";
      readonly reasonCode: "SIGNAL_ENGINE_FAILED";
      readonly message: string;
    });
