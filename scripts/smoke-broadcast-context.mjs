const endpoint =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/broadcast-context";

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://11qaws.github.io",
  },
  body: JSON.stringify({
    sourceDurationMs: 60_000,
    chapters: [
      {
        chapterId: "chapter-1",
        startMs: 0,
        endMs: 60_000,
        evidenceMode: "complete-transcript",
        evidenceCoverageRatio: 1,
        summaryKo: "스트리머가 실수를 인정하고 정확히 사과했다.",
      },
    ],
    candidates: [
      {
        candidateId: "candidate-1",
        startMs: 10_000,
        endMs: 55_000,
        transcriptKo: "제가 실수했습니다. 죄송합니다.",
        eventSummaryKo: "실수를 인정했다.",
        reactionSummaryKo: "차분하게 사과했다.",
        chatReactionSummaryKo: null,
      },
    ],
  }),
});

const payload = await response.json();
process.stdout.write(
  `${JSON.stringify(
    response.ok
      ? {
          status: response.status,
          broadcastSummaryKo: payload.broadcastSummaryKo,
          clipDecision: payload.annotations?.[0]?.clipDecision ?? null,
        }
      : { status: response.status, errorCode: payload.error?.code ?? "unknown" },
    null,
    2,
  )}\n`,
);
if (!response.ok) process.exitCode = 1;
