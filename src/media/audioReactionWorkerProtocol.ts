import type { FenceableEvent } from "../domain/eventFence";
import type {
  LocalAudioReactionAnalysisResult,
  SelectAudioReactionHighlightsOptions,
} from "./localAudioReactionAnalysisCore";

export const AUDIO_REACTION_FEATURE_WINDOW_MS = 1_000 as const;

export type AudioReactionWorkerIdentity = Omit<FenceableEvent, "eventId">;

export type LocalAudioReactionUnavailableReason =
  | "NO_AUDIO_TRACK"
  | "UNSUPPORTED_CONTAINER"
  | "UNSUPPORTED_AUDIO_CODEC";

/**
 * A recoverable outcome. It deliberately contains no File, PCM, codec
 * metadata, or source name so it is safe to pass into the result pipeline.
 */
export interface LocalAudioReactionUnavailableResult {
  readonly mode: "local-audio-reaction-unavailable";
  readonly sourceDurationMs: number;
  readonly featureWindowMs: typeof AUDIO_REACTION_FEATURE_WINDOW_MS;
  readonly plannedWindowCount: number;
  readonly analyzedWindowCount: 0;
  readonly coverageComplete: false;
  readonly candidates: readonly [];
  readonly reasonCode: LocalAudioReactionUnavailableReason;
}

export type LocalAudioReactionAnalysisOutcome =
  | LocalAudioReactionAnalysisResult
  | LocalAudioReactionUnavailableResult;

export type LocalAudioReactionAnalysisStage =
  | "opening-source"
  | "decoding-audio"
  | "scoring"
  | "complete"
  | "unavailable";

export interface LocalAudioReactionAnalysisProgress {
  readonly stage: LocalAudioReactionAnalysisStage;
  readonly decodedThroughMs: number;
  readonly sourceDurationMs: number;
  readonly analyzedWindowCount: number;
  readonly ratio: number;
}

export type AudioReactionWorkerRequest =
  | {
      readonly type: "analyze-audio-reactions";
      readonly identity: AudioReactionWorkerIdentity;
      readonly file: File;
      readonly sourceDurationMs: number;
      readonly options: SelectAudioReactionHighlightsOptions;
    }
  | {
      readonly type: "cancel-audio-reactions";
      readonly identity: AudioReactionWorkerIdentity;
    };

export type AudioReactionWorkerResponsePayload =
  | {
      readonly type: "audio-reaction-progress";
      readonly progress: LocalAudioReactionAnalysisProgress;
    }
  | {
      readonly type: "audio-reaction-completed";
      readonly result: LocalAudioReactionAnalysisResult;
    }
  | {
      readonly type: "audio-reaction-unavailable";
      readonly result: LocalAudioReactionUnavailableResult;
    }
  | {
      readonly type: "audio-reaction-cancel-acknowledged";
    }
  | {
      readonly type: "audio-reaction-failed";
      readonly reasonCode: "AUDIO_DECODE_FAILED" | "SIGNAL_ENGINE_FAILED";
      readonly message: string;
    };

export type AudioReactionWorkerResponse =
  FenceableEvent & AudioReactionWorkerResponsePayload;
