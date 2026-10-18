import type { ItadDeal } from "../schemas/itadDeals.js";
import type {
  FetchItadDealsOptions,
  FetchItadDealsResult,
} from "./itadDeals.js";
import { fetchItadDeals } from "./itadDeals.js";
import type { ItadApiClient } from "./itadApi.js";

export const DEFAULT_ITAD_DEALS_CACHE_TTL_MS = 15 * 60 * 1_000;

interface CacheEntry {
  expiresAt: number;
  result: Promise<FetchItadDealsResult>;
}

/** In-memory TTL cache for the complete paginated ITAD deal result. */
export class ItadDealsCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs = DEFAULT_ITAD_DEALS_CACHE_TTL_MS,
    private readonly clock: () => number = Date.now
  ) {}

  async get(
    client: ItadApiClient,
    options: FetchItadDealsOptions
  ): Promise<FetchItadDealsResult> {
    const key = JSON.stringify(options);
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.clock()) {
      return existing.result;
    }

    const entry: CacheEntry = {
      expiresAt: this.clock() + this.ttlMs,
      result: fetchItadDeals(client, options),
    };
    this.entries.set(key, entry);

    try {
      return await entry.result;
    } catch (error) {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    }
  }

  clear(): void {
    this.entries.clear();
  }

  /** A defensive copy helps callers avoid mutating cached deal records. */
  snapshotDeals(result: FetchItadDealsResult): ItadDeal[] {
    return result.deals.map((deal) => ({
      ...deal,
      deal: {
        ...deal.deal,
        shop: { ...deal.deal.shop },
        price: { ...deal.deal.price },
        regular: { ...deal.deal.regular },
        storeLow: deal.deal.storeLow ? { ...deal.deal.storeLow } : null,
        historyLow: deal.deal.historyLow ? { ...deal.deal.historyLow } : null,
        historyLow_1y: deal.deal.historyLow_1y
          ? { ...deal.deal.historyLow_1y }
          : null,
        historyLow_3m: deal.deal.historyLow_3m
          ? { ...deal.deal.historyLow_3m }
          : null,
        drm: deal.deal.drm.map((shop) => ({ ...shop })),
        platforms: deal.deal.platforms.map((shop) => ({ ...shop })),
      },
      assets: deal.assets ? { ...deal.assets } : undefined,
    }));
  }
}
