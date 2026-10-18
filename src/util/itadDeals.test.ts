import { describe, expect, it, vi } from "vitest";

import { makeItadDeal } from "../test/fixtures.js";
import type { ItadApiClient } from "./itadApi.js";
import {
  fetchItadDeals,
  filterValidGameDeals,
  generateDealId,
} from "./itadDeals.js";
import { ItadDealsCache } from "./itadDealsCache.js";
import { resolveSteamAppIds } from "./steamAppIdResolver.js";

const options = {
  country: "DE",
  pageSize: 2,
  maxPages: 2,
  minDiscountPercent: 35,
  maxPrice: 60,
  includeMature: false,
};

describe("ITAD deal collection and cache", () => {
  it("fetches paginated game deals with API-side type, price, and discount filters", async () => {
    const first = makeItadDeal();
    const second = makeItadDeal({
      id: "550e8400-e29b-41d4-a716-446655440002",
      title: "Second Game",
    });
    const third = makeItadDeal({
      id: "550e8400-e29b-41d4-a716-446655440003",
      title: "Third Game",
    });
    const getDealsPage = vi
      .fn()
      .mockResolvedValueOnce({
        nextOffset: 2,
        hasMore: true,
        list: [first, second],
      })
      .mockResolvedValueOnce({ nextOffset: 3, hasMore: false, list: [third] });
    const client = { getDealsPage } as unknown as ItadApiClient;

    const result = await fetchItadDeals(client, options);

    expect(result.deals.map((deal) => deal.title)).toEqual([
      "Test Game",
      "Second Game",
      "Third Game",
    ]);
    expect(result.pagesFetched).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.nextOffset).toBeNull();
    expect(getDealsPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        country: "DE",
        offset: 0,
        limit: 2,
        sort: "-cut",
        filter: {
          type: [1],
          cut: { min: 35, max: null },
          price: { min: 0, max: 60 },
        },
      })
    );
    expect(getDealsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 2 })
    );
  });

  it("marks a page-limited result as truncated and rejects broken pagination", async () => {
    const getDealsPage = vi.fn().mockResolvedValue({
      nextOffset: 2,
      hasMore: true,
      list: [makeItadDeal()],
    });
    const result = await fetchItadDeals(
      { getDealsPage } as unknown as ItadApiClient,
      { ...options, maxPages: 1 }
    );
    expect(result.truncated).toBe(true);
    expect(result.nextOffset).toBe(2);

    getDealsPage.mockResolvedValueOnce({
      nextOffset: 0,
      hasMore: true,
      list: [],
    });
    await expect(
      fetchItadDeals({ getDealsPage } as unknown as ItadApiClient, options)
    ).rejects.toThrow("did not advance");
  });

  it("rejects DLC, packages, and mature games before enrichment", () => {
    const result = filterValidGameDeals(
      [
        makeItadDeal(),
        makeItadDeal({
          id: "550e8400-e29b-41d4-a716-446655440004",
          type: "dlc",
        }),
        makeItadDeal({
          id: "550e8400-e29b-41d4-a716-446655440005",
          mature: true,
        }),
      ],
      false
    );

    expect(result.deals).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]?.reasons).toContain("not-a-game");
    expect(result.rejected[1]?.reasons).toContain("mature-content-disabled");
  });

  it("caches the complete ITAD deal result for 15 minutes and refreshes at expiry", async () => {
    let now = 100;
    const getDealsPage = vi.fn().mockResolvedValue({
      nextOffset: 0,
      hasMore: false,
      list: [makeItadDeal()],
    });
    const client = { getDealsPage } as unknown as ItadApiClient;
    const cache = new ItadDealsCache(15 * 60 * 1_000, () => now);

    await cache.get(client, options);
    await cache.get(client, options);
    expect(getDealsPage).toHaveBeenCalledTimes(1);

    now += 15 * 60 * 1_000;
    await cache.get(client, options);
    expect(getDealsPage).toHaveBeenCalledTimes(2);
  });

  it("evicts failed cache entries so a later run can retry", async () => {
    const getDealsPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("mock outage"))
      .mockResolvedValueOnce({
        nextOffset: 0,
        hasMore: false,
        list: [makeItadDeal()],
      });
    const cache = new ItadDealsCache(900_000, () => 0);
    const client = { getDealsPage } as unknown as ItadApiClient;

    await expect(cache.get(client, options)).rejects.toThrow("mock outage");
    await expect(cache.get(client, options)).resolves.toMatchObject({
      deals: [{ title: "Test Game" }],
    });
    expect(getDealsPage).toHaveBeenCalledTimes(2);
  });

  it("creates the persistent dedupe key from the ITAD game ID and shop ID", () => {
    expect(generateDealId(makeItadDeal())).toBe(
      "550e8400-e29b-41d4-a716-446655440000-61"
    );
  });
});

describe("ITAD Steam AppID resolver", () => {
  it("uses cached mappings first and resolves explicit app identifiers only", async () => {
    const firstId = "550e8400-e29b-41d4-a716-446655440010";
    const secondId = "550e8400-e29b-41d4-a716-446655440011";
    const lookupShopIds = vi.fn().mockResolvedValue({
      [secondId]: ["app/7656119", "steam/7656119"],
    });
    const result = await resolveSteamAppIds(
      { lookupShopIds } as unknown as ItadApiClient,
      [firstId, secondId],
      new Map([[firstId, 12345]])
    );

    expect(result.mappings).toEqual(
      new Map([
        [firstId, 12345],
        [secondId, 7656119],
      ])
    );
    expect(result.unresolvedGameIds).toEqual([]);
    expect(lookupShopIds).toHaveBeenCalledOnce();
  });

  it("reports missing and ambiguous mappings without guessing from titles", async () => {
    const missingId = "550e8400-e29b-41d4-a716-446655440012";
    const ambiguousId = "550e8400-e29b-41d4-a716-446655440013";
    const lookupShopIds = vi.fn().mockResolvedValue({
      [missingId]: null,
      [ambiguousId]: ["app/100", "app/200"],
    });
    const result = await resolveSteamAppIds(
      { lookupShopIds } as unknown as ItadApiClient,
      [missingId, ambiguousId],
      new Map()
    );

    expect(result.mappings.size).toBe(0);
    expect(result.unresolvedGameIds).toEqual([missingId]);
    expect(result.ambiguousGameIds).toEqual([ambiguousId]);
  });
});
