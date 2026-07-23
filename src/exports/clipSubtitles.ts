import type { CandidatePassBPresentationCue } from "../analysis/candidatePassBPresentation";

export interface ClipSubtitleRange {
  readonly startMs: number;
  readonly endMs: number;
}

export interface ClipSubtitleAvailability {
  readonly available: boolean;
  /** Korean explanation shown next to a disabled subtitle button. Present only when unavailable. */
  readonly reason?: string;
}

/**
 * How much of a clip's duration its transcript cues must cover before the
 * result can honestly be called a subtitle track rather than a few
 * scattered lines. Candidate cues are capped at three by the presentation
 * layer (`CANDIDATE_PASS_B_PRESENTATION_MAX_CUES`), so this only passes for
 * short clips where those few cues happen to span most of the range.
 */
const MINIMUM_COVERAGE_RATIO = 0.6;

function clampCueToRange(
  cue: CandidatePassBPresentationCue,
  range: ClipSubtitleRange,
): ClipSubtitleRange | null {
  const startMs = Math.max(cue.absoluteStartMs, range.startMs);
  const endMs = Math.min(cue.absoluteEndMs, range.endMs);
  return endMs > startMs ? { startMs, endMs } : null;
}

function coveredDurationMs(
  cues: readonly CandidatePassBPresentationCue[],
  range: ClipSubtitleRange,
): number {
  const clipped = cues
    .map((cue) => clampCueToRange(cue, range))
    .filter((cue): cue is ClipSubtitleRange => cue !== null)
    .sort((left, right) => left.startMs - right.startMs);
  let coveredMs = 0;
  let openStartMs: number | null = null;
  let openEndMs = 0;
  for (const cue of clipped) {
    if (openStartMs === null) {
      openStartMs = cue.startMs;
      openEndMs = cue.endMs;
      continue;
    }
    if (cue.startMs <= openEndMs) {
      openEndMs = Math.max(openEndMs, cue.endMs);
      continue;
    }
    coveredMs += openEndMs - openStartMs;
    openStartMs = cue.startMs;
    openEndMs = cue.endMs;
  }
  if (openStartMs !== null) {
    coveredMs += openEndMs - openStartMs;
  }
  return coveredMs;
}

/**
 * Whether a candidate's transcript cues cover enough of its clip range to
 * export as subtitles. Cues are a handful of AI-selected highlights, not a
 * continuous transcription, so most clips will not qualify — the caller
 * should disable the subtitle button and show `reason` rather than ship a
 * file with large silent-looking gaps.
 */
export function assessClipSubtitleCoverage(
  cues: readonly CandidatePassBPresentationCue[],
  range: ClipSubtitleRange,
): ClipSubtitleAvailability {
  if (range.endMs <= range.startMs) {
    return { available: false, reason: "구간 길이가 올바르지 않아요." };
  }
  if (cues.length === 0) {
    return { available: false, reason: "이 구간에는 확인된 대사 단서가 없어요." };
  }
  const durationMs = range.endMs - range.startMs;
  const ratio = coveredDurationMs(cues, range) / durationMs;
  if (ratio < MINIMUM_COVERAGE_RATIO) {
    return {
      available: false,
      reason: `대사 단서가 구간의 일부만 담고 있어 자막으로 받기엔 부족해요 (약 ${Math.round(ratio * 100)}% 확인).`,
    };
  }
  return { available: true };
}

function srtTimestamp(milliseconds: number): string {
  const clamped = Math.max(0, Math.round(milliseconds));
  const totalMs = clamped % 1_000;
  const totalSeconds = Math.floor(clamped / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(totalMs).padStart(3, "0")}`;
}

/**
 * A `.srt` file for one clip, with cue timestamps rebased to the clip's own
 * start (0 ms) rather than the source broadcast's absolute time — matching
 * how the rendered clip file itself is trimmed.
 */
export function buildClipSrt(
  cues: readonly CandidatePassBPresentationCue[],
  range: ClipSubtitleRange,
): string {
  const clipped = cues
    .map((cue) => {
      const clampedRange = clampCueToRange(cue, range);
      return clampedRange === null ? null : { ...clampedRange, text: cue.text };
    })
    .filter((cue): cue is ClipSubtitleRange & { text: string } => cue !== null)
    .sort((left, right) => left.startMs - right.startMs);

  const blocks = clipped.map((cue, index) => {
    const relativeStartMs = cue.startMs - range.startMs;
    const relativeEndMs = cue.endMs - range.startMs;
    return [
      String(index + 1),
      `${srtTimestamp(relativeStartMs)} --> ${srtTimestamp(relativeEndMs)}`,
      cue.text,
      "",
    ].join("\r\n");
  });

  return `${blocks.join("\r\n")}\r\n`;
}
