import { readFileSync, writeFileSync } from "node:fs";

const captionPath = process.argv[2];
const contextPath = process.argv[3];
const leadId = process.argv[4];
const outputPath = process.argv[5] ?? null;
const endpoint =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/broadcast-context";
const CELL_MS = 30_000;
const WINDOW_MS = 5 * 60_000;
const MAX_CELL_TEXT = 900;

if (!captionPath || !contextPath || !leadId) {
  throw new Error(
    "Usage: node scripts/evaluate-caption-refinement.mjs <caption.json3> <context.json> <lead-id> [output.json]",
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/u, ""));
}

function boundedText(values, maximumLength) {
  const text = values
    .join(" ")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return Array.from(text || "[대사 없음]").slice(0, maximumLength).join("").trim();
}

const captions = readJson(captionPath);
const parent = readJson(contextPath);
const sourceDurationMs = Number(parent.sourceDurationMs);
const lead = (Array.isArray(parent.discoveredLeads) ? parent.discoveredLeads : [])
  .find((item) => item?.leadId === leadId);
if (
  !lead ||
  !Number.isSafeInteger(lead.startMs) ||
  !Number.isSafeInteger(lead.endMs) ||
  lead.startMs < 0 ||
  lead.endMs <= lead.startMs ||
  lead.endMs > sourceDurationMs
) {
  throw new Error(`Unknown or invalid lead: ${leadId}`);
}

const events = [];
let previousText = "";
for (const event of Array.isArray(captions.events) ? captions.events : []) {
  const startMs = Number(event?.tStartMs);
  const durationMs = Math.max(0, Number(event?.dDurationMs) || 0);
  const text = (Array.isArray(event?.segs) ? event.segs : [])
    .map((segment) => (typeof segment?.utf8 === "string" ? segment.utf8 : ""))
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  if (!Number.isFinite(startMs) || text.length === 0 || text === previousText) continue;
  previousText = text;
  events.push({ startMs, endMs: startMs + durationMs, text });
}

async function refineWindow(windowStartMs, windowEndMs, windowIndex) {
  const chapters = [];
  for (let startMs = windowStartMs, index = 0; startMs < windowEndMs; startMs += CELL_MS) {
    const endMs = Math.min(windowEndMs, startMs + CELL_MS);
    const observed = events
      .filter((event) => event.startMs < endMs && event.endMs >= startMs)
      .map((event) => event.text);
    const parentCue = index === 0
      ? [`[상위 맥락] ${parent.broadcastSummaryKo} / ${lead.eventSummaryKo}`]
      : [];
    chapters.push({
      chapterId: `detail-${String(windowIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(3, "0")}`,
      startMs,
      endMs,
      evidenceMode: "complete-transcript",
      evidenceCoverageRatio: 1,
      summaryKo: boundedText([...parentCue, ...observed], MAX_CELL_TEXT),
    });
    index += 1;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://11qaws.github.io",
    },
    body: JSON.stringify({
      sourceDurationMs,
      chapters,
      candidates: [],
      analysisMode: "refinement",
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `Refinement window ${windowIndex + 1} failed with HTTP ${response.status}: ${payload.error?.code ?? "unknown"} (${payload.error?.message ?? "no message"}); finish=${response.headers.get("X-Upstream-Finish")}, length=${response.headers.get("X-Upstream-Content-Length")}, json=${response.headers.get("X-Upstream-Json")}`,
    );
  }
  return {
    windowStartMs,
    windowEndMs,
    chapterCount: chapters.length,
    broadcastSummaryKo: payload.broadcastSummaryKo,
    discoveredLeads: payload.discoveredLeads,
  };
}

const windows = [];
for (let startMs = lead.startMs, index = 0; startMs < lead.endMs; startMs += WINDOW_MS) {
  windows.push(refineWindow(startMs, Math.min(lead.endMs, startMs + WINDOW_MS), index));
  index += 1;
}
const windowResults = await Promise.all(windows);
const discoveredLeads = windowResults
  .flatMap((window) => window.discoveredLeads)
  .sort((left, right) => left.startMs - right.startMs || right.confidence - left.confidence);

const result = {
  parentLeadId: leadId,
  sourceDurationMs,
  refinedStartMs: lead.startMs,
  refinedEndMs: lead.endMs,
  windowCount: windowResults.length,
  chapterCount: windowResults.reduce((sum, window) => sum + window.chapterCount, 0),
  windows: windowResults.map((window) => ({
    windowStartMs: window.windowStartMs,
    windowEndMs: window.windowEndMs,
    chapterCount: window.chapterCount,
    broadcastSummaryKo: window.broadcastSummaryKo,
  })),
  discoveredLeads,
};
if (outputPath) {
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
