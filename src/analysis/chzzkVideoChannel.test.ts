import { describe, expect, it, vi } from "vitest";

import {
  CHZZK_VIDEO_CHANNEL_PROXY_ENDPOINT,
  chzzkVideoNoFromSourceName,
  parseChzzkVideoChannelResult,
  requestChzzkVideoChannel,
} from "./chzzkVideoChannel";

const VIDEO_NO = "13996057";
const CHANNEL_ID = "0385e1a232e51078bad18aef8479ab22";

describe("chzzkVideoChannel", () => {
  it("extracts only explicitly labelled CHZZK replay numbers", () => {
    expect(
      chzzkVideoNoFromSourceName(
        "https://chzzk.naver.com/video/13996057?share=1",
      ),
    ).toBe(VIDEO_NO);
    expect(chzzkVideoNoFromSourceName("치지직-13996057.mp4")).toBe(VIDEO_NO);
    expect(chzzkVideoNoFromSourceName("2026 07 17 - 음식 토크.mp4")).toBeNull();
    expect(chzzkVideoNoFromSourceName("방송 13996057.mp4")).toBeNull();
  });

  it("validates the replay and fixed-width channel identifier together", () => {
    expect(
      parseChzzkVideoChannelResult(
        { videoNo: VIDEO_NO, channelId: CHANNEL_ID },
        VIDEO_NO,
      ),
    ).toBe(CHANNEL_ID);
    expect(
      parseChzzkVideoChannelResult(
        { videoNo: "13996058", channelId: CHANNEL_ID },
        VIDEO_NO,
      ),
    ).toBeNull();
  });

  it("requests the fixed proxy without browser credentials", async () => {
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ videoNo: VIDEO_NO, channelId: CHANNEL_ID }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      requestChzzkVideoChannel(VIDEO_NO, { fetchImplementation }),
    ).resolves.toBe(CHANNEL_ID);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${CHZZK_VIDEO_CHANNEL_PROXY_ENDPOINT}?v=${VIDEO_NO}`,
      expect.objectContaining({ method: "GET", credentials: "omit" }),
    );
  });
});
