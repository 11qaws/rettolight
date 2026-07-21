import { readFileSync, writeFileSync } from "node:fs";

const captionPath = process.argv[2];
const fastPassPath = process.argv[3];
const outputPath = process.argv[4] ?? null;
const endpoint =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/broadcast-context";
// Two-minute cells keep the semantic event near its real location while still
// reducing a multi-hour caption track to a single inexpensive routing request.
// 900 Korean characters normally cover the decisive first 60-90 seconds of a
// cell; the next refinement pass re-opens the selected source range.
const CHAPTER_MS = 120_000;
const MAX_CHAPTER_TEXT = 1_800;

if (!captionPath || !fastPassPath) {
  throw new Error(
    "Usage: node scripts/evaluate-caption-context.mjs <caption.json3> <fastpass.json> [output.json]",
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/u, ""));
}

const captions = readJson(captionPath);
const fastPass = readJson(fastPassPath);
const sourceDurationMs = Number(fastPass.sourceDurationMs);
if (!Number.isSafeInteger(sourceDurationMs) || sourceDurationMs <= 0) {
  throw new Error("Invalid fast-pass source duration.");
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

function boundedText(values, maximumLength) {
  const joined = values
    .join(" ")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const points = Array.from(joined || "[대사 없음]");
  if (points.length <= maximumLength) return points.join("").trim();
  const separator = " … ";
  const count = 4;
  const size = Math.floor(
    (maximumLength - Array.from(separator).length * (count - 1)) / count,
  );
  const maximumStart = points.length - size;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.round((maximumStart * index) / (count - 1));
    return points.slice(start, start + size).join("");
  }).join(separator).trim();
}

const chapters = [];
for (let startMs = 0, index = 0; startMs < sourceDurationMs; startMs += CHAPTER_MS) {
  const endMs = Math.min(sourceDurationMs, startMs + CHAPTER_MS);
  chapters.push({
    chapterId: `caption-${String(index + 1).padStart(3, "0")}`,
    startMs,
    endMs,
    evidenceMode: "complete-transcript",
    evidenceCoverageRatio: 1,
    summaryKo: boundedText(
      events
        .filter((event) => event.startMs < endMs && event.endMs >= startMs)
        .map((event) => event.text),
      MAX_CHAPTER_TEXT,
    ),
  });
  index += 1;
}

const candidates = (Array.isArray(fastPass.candidates) ? fastPass.candidates : [])
  .slice(0, 12)
  .map((candidate, index) => ({
    candidateId: `fast-pass-${String(index + 1).padStart(2, "0")}`,
    startMs: candidate.startMs,
    endMs: candidate.endMs,
    transcriptKo: boundedText(
      events
        .filter(
          (event) => event.startMs < candidate.endMs && event.endMs >= candidate.startMs,
        )
        .map((event) => event.text),
      12_000,
    ),
    eventSummaryKo: "빠른 소리 분석에서 반응 가능성이 있다고 표시된 구간이다.",
    reactionSummaryKo: "아직 화면과 전체 방송 맥락으로 확인하지 않은 후보이다.",
    chatReactionSummaryKo: null,
  }));

function verifyText(label, value, maximumLength) {
  const controlCheckValue = value.replace(/[\n\r\t]/gu, "");
  if (
    value.trim() !== value ||
    Array.from(value).length > maximumLength ||
    /[\p{Cc}\p{Cf}]/u.test(controlCheckValue)
  ) {
    throw new Error(`Generated invalid context text: ${label}`);
  }
}
for (const chapter of chapters) verifyText(chapter.chapterId, chapter.summaryKo, 1_200);
for (const candidate of candidates) {
  verifyText(`${candidate.candidateId}:transcript`, candidate.transcriptKo, 12_000);
  verifyText(`${candidate.candidateId}:event`, candidate.eventSummaryKo, 1_200);
  verifyText(`${candidate.candidateId}:reaction`, candidate.reactionSummaryKo, 1_200);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://11qaws.github.io",
  },
  body: JSON.stringify({ sourceDurationMs, chapters, candidates }),
});
const payload = await response.json();
if (!response.ok) {
  throw new Error(
    `Context evaluation failed with HTTP ${response.status}: ${payload.error?.code ?? "unknown"} (${payload.error?.message ?? "no message"}); upstream=${response.headers.get("X-Upstream-Status") ?? "unknown"}`,
  );
}

const result = {
  sourceDurationMs,
  chapterCount: chapters.length,
  candidateCount: candidates.length,
  broadcastSummaryKo: payload.broadcastSummaryKo,
  recurringThemesKo: payload.recurringThemesKo,
  annotations: payload.annotations,
  semanticChapters: payload.semanticChapters,
  discoveredLeads: payload.discoveredLeads,
  coverage: payload.coverage,
};
if (outputPath) writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
