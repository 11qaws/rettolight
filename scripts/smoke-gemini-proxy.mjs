import { spawnSync } from "node:child_process";

const PROXY_ENDPOINT =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/candidate-insights";
const PRODUCTION_ORIGIN = "https://11qaws.github.io";
const SAMPLE_RATE_HZ = 16_000;
const DURATION_SECONDS = 30;
const PCM_BYTE_LENGTH = SAMPLE_RATE_HZ * DURATION_SECONDS * 2;

const sourcePath = process.argv[2];
const offsetSeconds = Number(process.argv[3] ?? 600);
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";

if (!sourcePath || !Number.isFinite(offsetSeconds) || offsetSeconds < 0) {
  throw new Error(
    "Usage: node scripts/smoke-gemini-proxy.mjs <video-path> [offset-seconds]",
  );
}

const extraction = spawnSync(
  ffmpegPath,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(offsetSeconds),
    "-t",
    String(DURATION_SECONDS),
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE_HZ),
    "-c:a",
    "pcm_s16le",
    "-f",
    "s16le",
    "pipe:1",
  ],
  {
    encoding: null,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  },
);

if (extraction.status !== 0) {
  const stderr = extraction.stderr?.toString("utf8").trim();
  throw new Error(stderr || "ffmpeg audio extraction failed.");
}

const pcm = extraction.stdout;
if (!Buffer.isBuffer(pcm) || pcm.byteLength !== PCM_BYTE_LENGTH) {
  throw new Error(`Unexpected PCM byte length: ${pcm?.byteLength ?? 0}`);
}

const wav = Buffer.allocUnsafe(44 + pcm.byteLength);
wav.write("RIFF", 0, "ascii");
wav.writeUInt32LE(36 + pcm.byteLength, 4);
wav.write("WAVE", 8, "ascii");
wav.write("fmt ", 12, "ascii");
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE_HZ, 24);
wav.writeUInt32LE(SAMPLE_RATE_HZ * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36, "ascii");
wav.writeUInt32LE(pcm.byteLength, 40);
pcm.copy(wav, 44);

const videoFrames = [3, 10, 20, 27].map((relativeSeconds) => {
  const frame = spawnSync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(offsetSeconds + relativeSeconds),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      "-q:v",
      "5",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "pipe:1",
    ],
    { encoding: null, maxBuffer: 1024 * 1024, windowsHide: true },
  );
  if (frame.status !== 0 || !Buffer.isBuffer(frame.stdout) || frame.stdout.length === 0) {
    throw new Error(`ffmpeg frame extraction failed at +${relativeSeconds}s`);
  }
  return {
    timestampMs: relativeSeconds * 1_000,
    mimeType: "image/jpeg",
    dataBase64: frame.stdout.toString("base64"),
  };
});

const response = await fetch(PROXY_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: PRODUCTION_ORIGIN,
  },
  body: JSON.stringify({
    audioBase64: wav.toString("base64"),
    candidateDurationMs: DURATION_SECONDS * 1_000,
    videoFrames,
  }),
});

const payload = await response.json();
if (!response.ok) {
  const code = payload?.error?.code ?? "UNKNOWN_PROXY_ERROR";
  throw new Error(
    `Proxy smoke failed with HTTP ${response.status}: ${code}; stop=${response.headers.get("X-Qwen-Stop")}, length=${response.headers.get("X-Qwen-Text-Length")}, content=${response.headers.get("X-Qwen-Content-Type")}, json=${response.headers.get("X-Qwen-Json")}, keys=${response.headers.get("X-Qwen-Keys")}`,
  );
}

const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
if (typeof text !== "string") {
  throw new Error("Gemini response did not contain structured text.");
}

const insight = JSON.parse(text);
const insightKeys = Object.keys(insight).sort();
const expectedInsightKeys = [
  "eventSummaryKo",
  "reactionSummaryKo",
  "segments",
  "uncertaintiesKo",
  "whyGoodClipKo",
].sort();
const segments = insight.segments;
const hasExactInsightKeys =
  insightKeys.length === expectedInsightKeys.length &&
  insightKeys.every((key, index) => key === expectedInsightKeys[index]);
const hasValidSegments =
  Array.isArray(segments) &&
  segments.length > 0 &&
  segments.every(
    (segment) =>
      Number.isSafeInteger(segment?.relativeStartMs) &&
      Number.isSafeInteger(segment?.relativeEndMs) &&
      segment.relativeStartMs >= 0 &&
      segment.relativeEndMs > segment.relativeStartMs &&
      segment.relativeEndMs <= DURATION_SECONDS * 1_000 &&
      typeof segment.text === "string" &&
      (segment.text === "[불명]" || /\p{Script=Hangul}/u.test(segment.text)),
  );
const hasKoreanTranscript =
  Array.isArray(segments) &&
  segments.some(
    (segment) =>
      typeof segment?.text === "string" &&
      /\p{Script=Hangul}/u.test(segment.text),
  );
const hasKoreanInterpretation =
  [
    insight.eventSummaryKo,
    insight.reactionSummaryKo,
    insight.whyGoodClipKo,
  ].every((value) => typeof value === "string" && /\p{Script=Hangul}/u.test(value)) &&
  Array.isArray(insight.uncertaintiesKo) &&
  insight.uncertaintiesKo.length > 0 &&
  insight.uncertaintiesKo.every(
    (value) => typeof value === "string" && /\p{Script=Hangul}/u.test(value),
  );
if (
  response.headers.get("access-control-allow-origin") !== PRODUCTION_ORIGIN ||
  response.headers.get("cache-control") !== "no-store" ||
  payload?.candidates?.[0]?.finishReason !== "STOP" ||
  !hasExactInsightKeys ||
  !hasValidSegments ||
  !hasKoreanTranscript ||
  !hasKoreanInterpretation
) {
  throw new Error("Proxy smoke response failed the Korean insight contract.");
}
const result = {
  status: response.status,
  allowOrigin: response.headers.get("access-control-allow-origin"),
  cacheControl: response.headers.get("cache-control"),
  finishReason: payload?.candidates?.[0]?.finishReason ?? null,
  segments,
  eventSummaryKo: insight.eventSummaryKo,
  reactionSummaryKo: insight.reactionSummaryKo,
  whyGoodClipKo: insight.whyGoodClipKo,
  uncertaintiesKo: insight.uncertaintiesKo,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
