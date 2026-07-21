import { readFileSync } from "node:fs";

const file = process.argv[2];
const patternSource = process.argv[3] ?? ".";
const startSeconds = Number(process.argv[4] ?? "0");
const endSeconds = Number(process.argv[5] ?? String(12 * 60 * 60));

if (
  !file ||
  !Number.isFinite(startSeconds) ||
  !Number.isFinite(endSeconds) ||
  startSeconds < 0 ||
  endSeconds <= startSeconds
) {
  throw new Error(
    "Usage: node scripts/inspect-youtube-caption-json3.mjs <json3> <regex> [start-seconds] [end-seconds]",
  );
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const pattern = new RegExp(patternSource, "iu");
const matches = [];
let previousText = "";

for (const event of Array.isArray(payload.events) ? payload.events : []) {
  const startMs = Number(event?.tStartMs);
  if (!Number.isFinite(startMs)) continue;
  if (startMs < startSeconds * 1_000 || startMs > endSeconds * 1_000) continue;
  const text = (Array.isArray(event?.segs) ? event.segs : [])
    .map((segment) => (typeof segment?.utf8 === "string" ? segment.utf8 : ""))
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  if (text.length === 0 || text === previousText) continue;
  previousText = text;
  if (!pattern.test(text)) continue;
  matches.push({
    startMs,
    endMs: startMs + Math.max(0, Number(event?.dDurationMs) || 0),
    text,
  });
}

process.stdout.write(`${JSON.stringify(matches.slice(0, 200), null, 2)}\n`);
