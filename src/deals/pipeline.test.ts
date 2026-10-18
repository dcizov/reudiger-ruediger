import { describe, expect, it, vi } from "vitest";

import {
  makeItadDeal,
  makeOverview,
  FIXED_NOW,
  mockedRequestUrl,
} from "../test/fixtures.js";
import type {
  DealMessageReference,
  DealPoster,
  DealPlacement,
  DealServiceConfig,
  DealStore,
  ScoredDeal,
} from "../types/deals.js";
import { ItadApiClient } from "../util/itadApi.js";
import { SteamStoreApiClient } from "../util/steamStoreApi.js";
import { DealPipeline } from "./pipeline.js";
import { DEFAULT_SCORE_WEIGHTS } from "./scoring.js";

const config: DealServiceConfig = {
  maxPrice: 60,
  minRegularPrice: 10,
  currency: "EUR",
  minDiscountPercent: 35,
  minReviewCount: 1_000,
  minMetacriticScore: 70,
  includeMature: false,
  allowVouchers: false,
  includedGenres: [],
  blockedGenres: [],
  country: "DE",
  mode: "top",
  topCount: 3,
  cooldownDays: 7,
  dealCacheTtlMs: 900_000,
  steamEnrichmentEnabled: true,
  steamCacheTtlMs: 86_400_000,
  steamRequestDelayMs: 0,
  itadDealsPageSize: 200,
  itadMaxDealPages: 2,
  itadSteamShopId: 61,
  claimLeaseMs: 120_000,
  preferredPublishers: [],
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
};

function steamResponse(appId: number, overrides: Record<string, unknown> = {}) {
  return {
    [String(appId)]: {
      success: true,
      data: {
        type: "game",
        name: `Steam game ${appId}`,
        steam_appid: appId,
        is_free: false,
        header_image: "https://cdn.example.test/header.jpg",
        developers: ["Test Studio"],
        publishers: ["Test Publisher"],
        genres: [{ description: "Action" }],
        recommendations: { total: 5_000 },
        metacritic: { score: 85 },
        release_date: { coming_soon: false, date: "2024" },
        ...overrides,
      },
    },
  };
}

function makeStore(
  steps: string[],
  overrides: Partial<DealStore> = {}
): DealStore {
  return {
    getPostedOfferKeys: vi.fn(() => {
      steps.push("posted-check");
      return Promise.resolve(new Set<string>());
    }),
    getCooledDownGameIds: vi.fn(() => Promise.resolve(new Set<string>())),
    getSteamMappings: vi.fn(() => {
      steps.push("mapping-cache");
      return Promise.resolve(new Map<string, number>());
    }),
    saveSteamMappings: vi.fn(() => {
      steps.push("save-mappings");
      return Promise.resolve();
    }),
    getSteamMetadata: vi.fn(() => {
      steps.push("metadata-cache");
      return Promise.resolve(new Map());
    }),
    saveSteamMetadata: vi.fn(() => {
      steps.push("save-metadata");
      return Promise.resolve();
    }),
    claimOffer: vi.fn(() => {
      steps.push("claim-offer");
      return Promise.resolve(true);
    }),
    markOfferPosted: vi.fn(() => {
      steps.push("persist-message");
      return Promise.resolve();
    }),
    releaseOffer: vi.fn(() => {
      steps.push("release-offer");
      return Promise.resolve();
    }),
    claimDealOfTheDay: vi.fn(() => Promise.resolve(true)),
    releaseDealOfTheDay: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function makePipeline(options: {
  dealResponse?: unknown;
  overviewResponse?: unknown;
  lookupResponse?: unknown;
  steamResponses?: Record<string, unknown>;
  store?: DealStore;
  mode?: DealServiceConfig["mode"];
  poster?: DealPoster;
  steamSuccessOverrides?: Record<string, unknown>;
  steps?: string[];
}) {
  const steps = options.steps ?? [];
  const deal = makeItadDeal();
  const overview = makeOverview(deal);
  const fetcher = vi.fn(
    (input: string | URL | Request, _init?: RequestInit) => {
      const url = mockedRequestUrl(input);
      if (url.pathname === "/deals/v2") {
        steps.push("itad-deals");
        return Promise.resolve(
          new Response(
            JSON.stringify(
              options.dealResponse ?? {
                nextOffset: 0,
                hasMore: false,
                list: [deal],
              }
            ),
            { status: 200 }
          )
        );
      }
      if (url.pathname === "/games/overview/v2") {
        steps.push("itad-overview");
        return Promise.resolve(
          new Response(
            JSON.stringify(
              options.overviewResponse ?? { prices: [overview], bundles: [] }
            ),
            { status: 200 }
          )
        );
      }
      if (url.pathname.startsWith("/lookup/shop/")) {
        steps.push("itad-lookup");
        return Promise.resolve(
          new Response(
            JSON.stringify(
              options.lookupResponse ?? { [deal.id]: ["app/12345"] }
            ),
            { status: 200 }
          )
        );
      }
      return Promise.reject(
        new Error(`Unexpected mocked ITAD path ${url.pathname}`)
      );
    }
  );
  const steamFetcher = vi.fn(
    (input: string | URL | Request, _init?: RequestInit) => {
      const url = mockedRequestUrl(input);
      const appId = Number(url.searchParams.get("appids"));
      steps.push("steam-appdetails");
      const payload =
        options.steamResponses?.[String(appId)] ??
        steamResponse(appId, options.steamSuccessOverrides);
      return Promise.resolve(
        new Response(JSON.stringify(payload), { status: 200 })
      );
    }
  );
  const poster: DealPoster = options.poster ?? {
    post: vi.fn(
      (
        _deal: ScoredDeal,
        _placement: DealPlacement,
        _rank: number
      ): Promise<DealMessageReference> => {
        steps.push("discord-post");
        return Promise.resolve({
          messageId: "mock-message-id",
          channelId: "mock-channel-id",
        });
      }
    ),
  };

  const itadClient = new ItadApiClient({
    apiKey: "mock-itad-key",
    fetcher,
    maxAttempts: 1,
    sleep: () => Promise.resolve(),
  });
  const steamClient = new SteamStoreApiClient({
    fetcher: steamFetcher,
    requestIntervalMs: 0,
  });
  const store = options.store ?? makeStore(steps);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const pipeline = new DealPipeline({
    config: { ...config, mode: options.mode ?? config.mode },
    itadClient,
    steamClient,
    store,
    poster,
    logger,
    now: () => FIXED_NOW,
  });

  return {
    pipeline,
    fetcher,
    steamFetcher,
    store,
    poster,
    steps,
    logger,
    deal,
  };
}

describe("ITAD-to-Discord pipeline", () => {
  it("runs the ordered pipeline and persists a posted offer", async () => {
    const harness = makePipeline({ steps: [] });

    const result = await harness.pipeline.run();

    expect(result).toMatchObject({
      status: "posted",
      fetched: 1,
      qualified: 1,
      posted: 1,
    });
    expect(harness.steps).toEqual([
      "itad-deals",
      "posted-check",
      "itad-overview",
      "mapping-cache",
      "itad-lookup",
      "save-mappings",
      "metadata-cache",
      "steam-appdetails",
      "save-metadata",
      "claim-offer",
      "discord-post",
      "persist-message",
    ]);
    expect(vi.mocked(harness.poster.post)).toHaveBeenCalledOnce();
    expect(vi.mocked(harness.store.markOfferPosted)).toHaveBeenCalledOnce();
    expect(harness.fetcher).toHaveBeenCalledTimes(3);
    expect(harness.steamFetcher).toHaveBeenCalledOnce();
  });

  it("does not post a deal that was persisted before restart", async () => {
    const deal = makeItadDeal();
    const steps: string[] = [];
    const store = makeStore(steps, {
      getPostedOfferKeys: vi.fn(() =>
        Promise.resolve(new Set([`${deal.id}-61`]))
      ),
    });
    const harness = makePipeline({ store, steps });

    const result = await harness.pipeline.run();

    expect(result).toMatchObject({ status: "no-deals", posted: 0 });
    expect(vi.mocked(harness.poster.post)).not.toHaveBeenCalled();
    expect(harness.fetcher).toHaveBeenCalledOnce();
  });

  it("selects one highest-ranked deal outside cooldown and persists its seven-day claim", async () => {
    const first = makeItadDeal({
      title: "A cooled-down game",
      id: "550e8400-e29b-41d4-a716-446655440030",
    });
    const second = makeItadDeal({
      title: "B available game",
      id: "550e8400-e29b-41d4-a716-446655440031",
    });
    const steps: string[] = [];
    const store = makeStore(steps, {
      getCooledDownGameIds: vi.fn(() => Promise.resolve(new Set([first.id]))),
      claimDealOfTheDay: vi.fn(() => Promise.resolve(true)),
    });
    const dailyPost = vi.fn(
      (
        _deal: ScoredDeal,
        _placement: DealPlacement,
        _rank: number
      ): Promise<DealMessageReference> => {
        steps.push("discord-post");
        return Promise.resolve({
          messageId: "daily-message",
          channelId: "mock-channel-id",
        });
      }
    );
    const poster: DealPoster = { post: dailyPost };
    const harness = makePipeline({
      mode: "deal-of-the-day",
      steps,
      store,
      poster,
      dealResponse: { nextOffset: 0, hasMore: false, list: [first, second] },
      overviewResponse: {
        prices: [makeOverview(first), makeOverview(second)],
        bundles: [],
      },
      lookupResponse: {
        [first.id]: ["app/12345"],
        [second.id]: ["app/12346"],
      },
      steamResponses: {
        "12345": steamResponse(12345),
        "12346": steamResponse(12346),
      },
    });

    const result = await harness.pipeline.run();

    expect(result).toMatchObject({ status: "posted", qualified: 2, posted: 1 });
    expect(dailyPost).toHaveBeenCalledOnce();
    expect(dailyPost.mock.calls[0]?.[0].deal.id).toBe(second.id);
    expect(dailyPost.mock.calls[0]?.[1]).toBe("deal-of-the-day");
    const markCall = vi.mocked(store.markOfferPosted).mock.calls[0];
    expect(markCall?.[0]).toBe(second.id);
    expect(markCall?.[5]).toMatchObject({
      cooldownUntil: new Date("2026-10-26T10:00:00.000Z"),
    });
    expect(vi.mocked(store.claimDealOfTheDay)).toHaveBeenCalledOnce();
  });

  it("posts nothing when Steam says the game is coming soon", async () => {
    const harness = makePipeline({
      steamSuccessOverrides: {
        release_date: { coming_soon: true, date: "Coming soon" },
      },
    });

    const result = await harness.pipeline.run();

    expect(result).toMatchObject({
      status: "no-deals",
      qualified: 0,
      posted: 0,
    });
    expect(vi.mocked(harness.poster.post)).not.toHaveBeenCalled();
  });

  it("contains API failures and returns a failed run instead of crashing the scheduler", async () => {
    const steps: string[] = [];
    const failingFetch = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        Promise.reject(new Error("mock network failure"))
    );
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const pipeline = new DealPipeline({
      config,
      itadClient: new ItadApiClient({
        apiKey: "mock-itad-key",
        fetcher: failingFetch,
        maxAttempts: 1,
      }),
      steamClient: new SteamStoreApiClient({
        fetcher: failingFetch,
        requestIntervalMs: 0,
      }),
      store: makeStore(steps),
      poster: {
        post: vi.fn(
          (
            _deal: ScoredDeal,
            _placement: DealPlacement,
            _rank: number
          ): Promise<DealMessageReference> =>
            Promise.resolve({
              messageId: "unused-message",
              channelId: "unused-channel",
            })
        ),
      },
      logger,
      now: () => FIXED_NOW,
    });

    await expect(pipeline.run()).resolves.toMatchObject({ status: "failed" });
    expect(logger.error).toHaveBeenCalledWith(
      "Deal pipeline failed; the scheduler will continue",
      expect.objectContaining({ errorType: "ItadApiError" })
    );
    expect(failingFetch).toHaveBeenCalledOnce();
  });
});
