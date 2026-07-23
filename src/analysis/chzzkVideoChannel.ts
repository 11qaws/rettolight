export const CHZZK_VIDEO_CHANNEL_PROXY_ENDPOINT =
  "https://rettohighlight-gemini.11qaws.workers.dev/v1/chzzk-video-channel" as const;

const CHZZK_VIDEO_NO_PATTERN = /^\d{7,12}$/u;
const CHZZK_CHANNEL_ID_PATTERN = /^[a-f0-9]{32}$/u;
const MAX_CHZZK_VIDEO_CHANNEL_RESPONSE_BYTES = 4 * 1024;

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts only an explicitly labelled CHZZK replay number. Bare digit runs in
 * filenames are intentionally ignored because dates and timestamps are common.
 */
export function chzzkVideoNoFromSourceName(sourceName: string): string | null {
  if (typeof sourceName !== "string") return null;
  const normalized = sourceName.normalize("NFC");
  const urlMatch = normalized.match(
    /(?:https?:\/\/)?(?:www\.)?chzzk\.naver\.com\/(?:video|videos)\/(\d{7,12})(?:[/?#]|$)/iu,
  );
  if (urlMatch?.[1] !== undefined) return urlMatch[1];
  const labelledMatch = normalized.match(
    /(?:chzzk|치지직)[^\d]{0,12}(\d{7,12})(?!\d)/iu,
  );
  return labelledMatch?.[1] ?? null;
}

export function parseChzzkVideoChannelResult(
  value: unknown,
  expectedVideoNo: string,
): string | null {
  if (
    !CHZZK_VIDEO_NO_PATTERN.test(expectedVideoNo) ||
    !isRecord(value) ||
    value.videoNo !== expectedVideoNo ||
    typeof value.channelId !== "string" ||
    !CHZZK_CHANNEL_ID_PATTERN.test(value.channelId)
  ) {
    return null;
  }
  return value.channelId;
}

export async function requestChzzkVideoChannel(
  videoNo: string,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImplementation?: FetchImplementation;
  } = {},
): Promise<string> {
  if (!CHZZK_VIDEO_NO_PATTERN.test(videoNo)) {
    throw new RangeError("Invalid CHZZK video number.");
  }
  const response = await (options.fetchImplementation ?? fetch)(
    `${CHZZK_VIDEO_CHANNEL_PROXY_ENDPOINT}?v=${encodeURIComponent(videoNo)}`,
    {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("CHZZK video channel is unavailable.");
  }
  const declaredLength = response.headers.get("Content-Length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) ||
      Number(declaredLength) > MAX_CHZZK_VIDEO_CHANNEL_RESPONSE_BYTES)
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("CHZZK video channel response is too large.");
  }
  const text = await response.text();
  if (
    new TextEncoder().encode(text).byteLength >
    MAX_CHZZK_VIDEO_CHANNEL_RESPONSE_BYTES
  ) {
    throw new Error("CHZZK video channel response is too large.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("CHZZK video channel response is invalid.");
  }
  const channelId = parseChzzkVideoChannelResult(payload, videoNo);
  if (channelId === null) {
    throw new Error("CHZZK video channel response is invalid.");
  }
  return channelId;
}
