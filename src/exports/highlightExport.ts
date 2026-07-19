import type { UnifiedHighlightCandidate } from "../analysis/highlightFusion";
import { buildHighlightNarrative } from "../analysis/highlightNarrative";
import type {
  DurableAnalysisInputDescriptor,
  DurableAnalysisSelectionSummary,
} from "../storage/durableAnalysisPayload";

export type HighlightExportFormat = "csv" | "markdown" | "json";

export interface HighlightExportRequest {
  readonly appVersion: string;
  readonly engineVersion: string;
  readonly generatedAt: string;
  readonly input: DurableAnalysisInputDescriptor;
  readonly selection: DurableAnalysisSelectionSummary;
  readonly candidates: readonly UnifiedHighlightCandidate[];
}

export interface HighlightExportFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: string;
}

const EXPORT_SCHEMA_VERSION = "0.3.0";

function assertMilliseconds(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("A highlight timecode must be a finite non-negative number.");
  }
}

export function formatHighlightTimecode(milliseconds: number): string {
  assertMilliseconds(milliseconds);
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function chronologicalCandidates(
  candidates: readonly UnifiedHighlightCandidate[],
): readonly UnifiedHighlightCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      left.startMs - right.startMs ||
      left.endMs - right.endMs ||
      left.id.localeCompare(right.id),
  );
}

function normalizedText(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

function signalLabel(candidate: UnifiedHighlightCandidate): string {
  const labels: string[] = [];
  if (candidate.signalKinds.includes("audio")) {
    labels.push("스트리머 오디오 반응");
  }
  if (candidate.signalKinds.includes("chat")) {
    labels.push("채팅 반응");
  }
  if (candidate.signalKinds.includes("visual")) {
    labels.push("화면 맥락");
  }
  return labels.join(" + ");
}

function evidenceLabel(candidate: UnifiedHighlightCandidate): string {
  const evidence: string[] = [];
  if (candidate.evidence.audio !== undefined) {
    const audio = candidate.evidence.audio;
    evidence.push(
      audio.eventKind === "sustained-vocal-reaction"
        ? "지속되는 음성형 반응"
        : "짧고 큰 오디오 반응",
      `오디오 반응 상위 ${topPercent(audio.rankPercentile)}%`,
    );
    if (audio.rmsLiftRatio !== undefined) {
      evidence.push(`평소 음량의 ${audio.rmsLiftRatio.toFixed(1)}배`);
    }
  }
  if (candidate.evidence.visual !== undefined) {
    evidence.push(`화면 변화 상위 ${topPercent(candidate.evidence.visual.rankPercentile)}%`);
  }
  if (candidate.evidence.chat !== undefined) {
    evidence.push(
      `채팅 ${candidate.evidence.chat.messageCount}개`,
      `참여자 ${candidate.evidence.chat.uniqueAuthorCount}명`,
      `평소의 ${candidate.evidence.chat.burstRatio.toFixed(1)}배`,
    );
  }
  return evidence.join(" · ");
}

function topPercent(rankPercentile: number): number {
  return Math.max(1, Math.round((1 - rankPercentile) * 100));
}

function spreadsheetSafeText(value: string): string {
  const normalized = normalizedText(value);
  return /^[\t\r ]*[=+\-@]/u.test(normalized) ? `'${normalized}` : normalized;
}

function csvCell(value: string | number): string {
  const safeValue = spreadsheetSafeText(String(value));
  return `"${safeValue.replace(/"/gu, '""')}"`;
}

function createCsv(candidates: readonly UnifiedHighlightCandidate[]): string {
  const header = [
    "순서",
    "시작",
    "끝",
    "길이",
    "가장 강한 순간",
    "AI가 고른 이유",
    "신호",
    "근거 요약",
    "상대 점수",
    "무슨 일이 있었나 (추정)",
    "스트리머 반응",
    "시청자 반응",
    "추천 이유",
    "해석 수준",
  ];
  const rows = chronologicalCandidates(candidates).map((candidate, index) => {
    const narrative = buildHighlightNarrative(candidate);
    return [
      index + 1,
      formatHighlightTimecode(candidate.startMs),
      formatHighlightTimecode(candidate.endMs),
      formatHighlightTimecode(candidate.endMs - candidate.startMs),
      formatHighlightTimecode(candidate.peakMs),
      candidate.reason,
      signalLabel(candidate),
      evidenceLabel(candidate),
      Math.round(candidate.score * 100),
      narrative.event,
      narrative.streamerReaction,
      narrative.audienceReaction,
      narrative.whyRecommended,
      narrative.basisLabel,
    ];
  });

  return `\uFEFF${[header, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n")}\r\n`;
}

function markdownText(value: string): string {
  return normalizedText(value).replace(/\\/gu, "\\\\");
}

function createMarkdown(request: HighlightExportRequest): string {
  const candidates = chronologicalCandidates(request.candidates);
  const lines = [
    "# Retto Highlight 편집 시간표",
    "",
    `- 만든 시각: ${request.generatedAt}`,
    `- 원본 길이: ${formatHighlightTimecode(request.input.source.durationMs)}`,
    `- 승인한 장면: ${candidates.length}개`,
    "",
    "> 이 문서는 시작·끝 시간을 정리한 편집용 목록이며, 영상 클립 파일은 포함하지 않습니다.",
    "",
  ];

  for (const [index, candidate] of candidates.entries()) {
    const narrative = buildHighlightNarrative(candidate);
    lines.push(
      `## ${index + 1}. ${formatHighlightTimecode(candidate.startMs)}–${formatHighlightTimecode(candidate.endMs)}`,
      "",
      `- 길이: ${formatHighlightTimecode(candidate.endMs - candidate.startMs)}`,
      `- 가장 강한 순간: ${formatHighlightTimecode(candidate.peakMs)}`,
      `- 해석 수준: ${narrative.basisLabel}`,
      `- 무슨 일이 있었나: ${markdownText(narrative.event)}`,
      `- 스트리머 반응: ${markdownText(narrative.streamerReaction)}`,
      `- 시청자 반응: ${markdownText(narrative.audienceReaction)}`,
      `- AI가 고른 이유: ${markdownText(narrative.whyRecommended)}`,
      `- 신호: ${signalLabel(candidate)}`,
      `- 근거: ${evidenceLabel(candidate) || "추가 근거 없음"}`,
      `- 확인할 점: ${markdownText(narrative.reviewHint)}`,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function exportedAudioSummary(selection: DurableAnalysisSelectionSummary):
  | {
      readonly plannedWindows: number;
      readonly analyzedWindows: number;
      readonly gapReasonCode: DurableAnalysisSelectionSummary["audioGapReasonCode"];
    }
  | {
      readonly analysisStatus: "not-recorded-in-source-result";
      readonly reason: "source-result-predates-audio-analysis";
      readonly message: "해당 결과 버전에는 오디오 분석 정보가 없습니다.";
    } {
  const plannedWindows = selection.plannedAudioWindowCount;
  const analyzedWindows = selection.analyzedAudioWindowCount;
  const gapReasonCode = selection.audioGapReasonCode;
  const hasPlanned = plannedWindows !== undefined;
  const hasAnalyzed = analyzedWindows !== undefined;
  const hasGapReason = gapReasonCode !== undefined;
  const presentCount = Number(hasPlanned) + Number(hasAnalyzed) + Number(hasGapReason);
  if (presentCount === 0) {
    return {
      analysisStatus: "not-recorded-in-source-result",
      reason: "source-result-predates-audio-analysis",
      message: "해당 결과 버전에는 오디오 분석 정보가 없습니다.",
    };
  }
  if (presentCount !== 3) {
    throw new TypeError("Audio selection fields must be all present or all absent.");
  }
  if (plannedWindows === undefined || analyzedWindows === undefined || gapReasonCode === undefined) {
    throw new TypeError("Audio selection fields must be all present or all absent.");
  }
  return {
    plannedWindows,
    analyzedWindows,
    gapReasonCode,
  };
}

function createJson(request: HighlightExportRequest): string {
  const payload = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    appVersion: request.appVersion,
    engine: request.engineVersion,
    generatedAt: request.generatedAt,
    source: {
      sizeBytes: request.input.source.sizeBytes,
      durationMs: request.input.source.durationMs,
      kind: request.input.source.kind,
      container: request.input.source.container,
      contentFingerprint: request.input.source.contentFingerprint,
    },
    chat: {
      timestampBasis: request.input.chat.timestampBasis,
      importedRows: request.input.chat.importedRowCount,
      analyzedRows: request.selection.analyzedChatMessageCount,
      skippedRows: request.selection.skippedChatMessageCount,
      gapReasonCode: request.selection.chatGapReasonCode,
      offsetMs: request.input.chat.offsetMs,
    },
    audio: exportedAudioSummary(request.selection),
    candidates: chronologicalCandidates(request.candidates).map(
      (candidate) => {
        const { id, startMs, endMs, peakMs, score, signalKinds, evidence } = candidate;
        return {
          id,
          startMs,
          endMs,
          peakMs,
          score,
          signalKinds,
          evidence,
          interpretation: buildHighlightNarrative(candidate),
          reviewState: "approved" as const,
        };
      },
    ),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function createHighlightExportFile(
  format: HighlightExportFormat,
  request: HighlightExportRequest,
): HighlightExportFile {
  if (format === "csv") {
    return {
      fileName: "retto-highlight-timeline.csv",
      mimeType: "text/csv;charset=utf-8",
      content: createCsv(request.candidates),
    };
  }
  if (format === "markdown") {
    return {
      fileName: "retto-highlight-timeline.md",
      mimeType: "text/markdown;charset=utf-8",
      content: createMarkdown(request),
    };
  }
  return {
    fileName: "retto-highlight-candidates.json",
    mimeType: "application/json;charset=utf-8",
    content: createJson(request),
  };
}

export function createHighlightClipboardText(
  candidates: readonly UnifiedHighlightCandidate[],
): string {
  const orderedCandidates = chronologicalCandidates(candidates);
  return [
    `Retto Highlight · 승인한 장면 ${orderedCandidates.length}개`,
    ...orderedCandidates.map(
      (candidate, index) => {
        const narrative = buildHighlightNarrative(candidate);
        return `${index + 1}. ${formatHighlightTimecode(candidate.startMs)}–${formatHighlightTimecode(candidate.endMs)} · ${normalizedText(narrative.whyRecommended)}`;
      },
    ),
  ].join("\n");
}
