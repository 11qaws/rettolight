import { readFileSync, writeFileSync } from "node:fs";

const contextPath = process.argv[2];
const refinementPath = process.argv[3];
const outputPath = process.argv[4] ?? null;
const endpoint =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/broadcast-context";

if (!contextPath || !refinementPath) {
  throw new Error(
    "Usage: node scripts/evaluate-caption-selection.mjs <context.json> <refinement.json> [output.json]",
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/u, ""));
}

function bounded(value, maximumLength) {
  return Array.from(String(value).replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim())
    .slice(0, maximumLength)
    .join("")
    .trim();
}

const context = readJson(contextPath);
const refinement = readJson(refinementPath);
const sourceDurationMs = Number(context.sourceDurationMs);
const parentLead = (Array.isArray(context.discoveredLeads) ? context.discoveredLeads : [])
  .find((lead) => lead?.leadId === refinement.parentLeadId);
if (!parentLead) throw new Error("The refinement parent lead is missing.");

const ranked = (Array.isArray(refinement.discoveredLeads) ? refinement.discoveredLeads : [])
  .filter((lead) => Number.isFinite(lead?.confidence))
  .sort((left, right) => right.confidence - left.confidence || left.startMs - right.startMs)
  .slice(0, 12);
const candidateMap = new Map();
const candidates = ranked.map((lead, index) => {
  const candidateId = `jury-${String(index + 1).padStart(2, "0")}`;
  candidateMap.set(candidateId, lead);
  return {
    candidateId,
    startMs: lead.startMs,
    endMs: lead.endMs,
    transcriptKo: bounded(lead.evidenceCueKo || "대사 근거 재확인 필요", 12_000),
    eventSummaryKo: bounded(lead.eventSummaryKo, 1_200),
    reactionSummaryKo: bounded(lead.whyThisMomentKo, 1_200),
    chatReactionSummaryKo: null,
  };
});

const chapters = [{
  chapterId: "selection-context",
  startMs: parentLead.startMs,
  endMs: parentLead.endMs,
  evidenceMode: "candidate-context-only",
  evidenceCoverageRatio: 1,
  summaryKo: bounded(
    `${context.broadcastSummaryKo} / 상위 사건: ${parentLead.eventSummaryKo}`,
    1_200,
  ),
}];

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://11qaws.github.io",
  },
  body: JSON.stringify({
    sourceDurationMs,
    chapters,
    candidates,
    analysisMode: "selection",
  }),
});
const payload = await response.json();
if (!response.ok) {
  throw new Error(
    `Selection failed with HTTP ${response.status}: ${payload.error?.code ?? "unknown"} (${payload.error?.message ?? "no message"}); finish=${response.headers.get("X-Upstream-Finish")}, length=${response.headers.get("X-Upstream-Content-Length")}, json=${response.headers.get("X-Upstream-Json")}`,
  );
}

const annotations = Array.isArray(payload.annotations) ? payload.annotations : [];
const selected = annotations
  .filter((annotation) => annotation.clipDecision === "select")
  .map((annotation) => ({
    ...candidateMap.get(annotation.candidateId),
    editorialConfidence: annotation.confidence,
    editorialReasonKo: annotation.whyThisMomentKo,
  }))
  .sort((left, right) => left.startMs - right.startMs);
const result = {
  sourceDurationMs,
  consideredCount: candidates.length,
  selectedCount: selected.length,
  summaryKo: payload.broadcastSummaryKo,
  selected,
  annotations,
};
if (outputPath) writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
