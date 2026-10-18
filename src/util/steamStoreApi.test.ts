import { describe, expect, it, vi } from "vitest";

import { mockedRequestUrl } from "../test/fixtures.js";
import { SteamStoreApiClient } from "./steamStoreApi.js";

function appDetailsResponse(appId: number) {
  return {
    [String(appId)]: {
      success: true,
      data: {
        type: "game",
        name: "Example Steam Game",
        steam_appid: appId,
        is_free: false,
        header_image: "https://cdn.example.test/header.jpg",
        developers: ["Studio"],
        publishers: ["Publisher"],
        genres: [{ description: "Action" }],
        recommendations: { total: 4_321 },
        metacritic: { score: 84 },
        release_date: { coming_soon: false, date: "01 Jan, 2024" },
      },
    },
  };
}

describe("Steam Store appdetails boundary", () => {
  it("validates and normalizes metadata without deriving a positive-review ratio", async () => {
    const fetcher = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          new Response(JSON.stringify(appDetailsResponse(12345)), {
            status: 200,
          })
        )
    );
    const client = new SteamStoreApiClient({
      fetcher,
      requestIntervalMs: 0,
    });

    const metadata = await client.getGameMetadata(12345, { country: "DE" });

    expect(metadata).toMatchObject({
      appId: 12345,
      name: "Example Steam Game",
      type: "game",
      isFree: false,
      comingSoon: false,
      totalReviews: 4_321,
      metacriticScore: 84,
      genres: ["Action"],
    });
    expect(metadata && "positiveReviewPercentage" in metadata).toBe(false);
    const [input] = fetcher.mock.calls[0] ?? [];
    const url = mockedRequestUrl(input ?? "");
    expect(url.pathname).toBe("/api/appdetails/");
    expect(url.searchParams.get("appids")).toBe("12345");
    expect(url.searchParams.get("cc")).toBe("de");
  });

  it("returns null for non-game appdetails envelopes and invalid app IDs", async () => {
    const fetcher = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          new Response(
            JSON.stringify({ "12345": { success: false, data: null } }),
            { status: 200 }
          )
        )
    );
    const client = new SteamStoreApiClient({
      fetcher,
      requestIntervalMs: 0,
    });

    expect(await client.getGameMetadata(0, { country: "DE" })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await client.getGameMetadata(12345, { country: "DE" })).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("returns null and logs safely for malformed Steam metadata", async () => {
    const warn = vi.fn();
    const fetcher = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          new Response(JSON.stringify({ "12345": { success: "yes" } }), {
            status: 200,
          })
        )
    );
    const client = new SteamStoreApiClient({
      fetcher,
      requestIntervalMs: 0,
      logger: { info: vi.fn(), warn, error: vi.fn() },
    });

    expect(await client.getGameMetadata(12345, { country: "DE" })).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "Steam Store response did not match its schema",
      expect.objectContaining({ appId: 12345 })
    );
  });

  it("retries a transient response and honors a zero Retry-After delay", async () => {
    let calls = 0;
    const fetcher = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) => {
        calls += 1;
        return Promise.resolve(
          calls === 1
            ? new Response("", { status: 429, headers: { "retry-after": "0" } })
            : new Response(JSON.stringify(appDetailsResponse(12345)), {
                status: 200,
              })
        );
      }
    );
    const sleep = vi.fn(() => Promise.resolve());
    const client = new SteamStoreApiClient({
      fetcher,
      requestIntervalMs: 0,
      sleep,
    });

    expect(
      await client.getGameMetadata(12345, { country: "DE" })
    ).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });
});
