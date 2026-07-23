export interface BroadcastSummaryCitationCandidate {
  readonly candidateId: string;
  readonly candidateNumber: number;
  readonly situationKo: string;
  readonly topicContextKo: string;
}

export interface BroadcastSummaryCitationPart {
  readonly text: string;
  readonly candidateIds: readonly string[];
  readonly emphasized: boolean;
}

export interface BroadcastSummaryCitationPresentation {
  readonly parts: readonly BroadcastSummaryCitationPart[];
  readonly citedCandidateIds: readonly string[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentences(value: string): readonly string[] {
  const normalized = normalizeText(value);
  if (normalized.length === 0) return [];
  return (
    normalized.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu) ?? [normalized]
  ).map((sentence) => sentence.trim()).filter(Boolean);
}

function tokens(value: string): ReadonlySet<string> {
  return new Set(
    normalizeText(value)
      .toLocaleLowerCase("ko-KR")
      .split(/[^\p{L}\p{N}]+/gu)
      .map((token) => token.trim())
      .filter((token) => Array.from(token).length >= 2),
  );
}

function overlapScore(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += Math.min(8, Array.from(token).length);
  }
  return score;
}

/**
 * Links only application-known final candidates to the broadcast summary.
 * Candidate numbers are never accepted from model prose, so citations cannot
 * drift when the final set changes.
 */
export function buildBroadcastSummaryCitationPresentation(
  broadcastSummaryKo: string,
  candidates: readonly BroadcastSummaryCitationCandidate[],
): BroadcastSummaryCitationPresentation {
  const summarySentences = sentences(broadcastSummaryKo);
  const candidateIdsBySentence = summarySentences.map(() => [] as string[]);
  const appended: BroadcastSummaryCitationPart[] = [];
  const citedCandidateIds: string[] = [];

  for (const candidate of [...candidates].sort(
    (left, right) => left.candidateNumber - right.candidateNumber,
  )) {
    const candidateTokens = tokens(
      `${candidate.topicContextKo} ${candidate.situationKo}`,
    );
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < summarySentences.length; index += 1) {
      const score = overlapScore(candidateTokens, tokens(summarySentences[index]!));
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex >= 0 && bestScore >= 2) {
      candidateIdsBySentence[bestIndex]!.push(candidate.candidateId);
    } else {
      const situationKo = normalizeText(candidate.situationKo);
      if (situationKo.length > 0) {
        appended.push({
          text: /[.!?。！？]$/u.test(situationKo)
            ? situationKo
            : `${situationKo}.`,
          candidateIds: [candidate.candidateId],
          emphasized: true,
        });
      }
    }
    citedCandidateIds.push(candidate.candidateId);
  }

  const parts = summarySentences.map((text, index) => ({
    text,
    candidateIds: candidateIdsBySentence[index]!,
    emphasized: candidateIdsBySentence[index]!.length > 0,
  }));
  return {
    parts: [...parts, ...appended],
    citedCandidateIds,
  };
}
