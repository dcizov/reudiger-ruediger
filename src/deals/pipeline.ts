import { randomUUID } from "node:crypto";

import type {
  DealLogger,
  DealPostingRecord,
  DealPoster,
  DealServiceConfig,
  DealStore,
  ScoredDeal,
} from "../types/deals.js";
import { dealLogger, safeErrorName } from "../util/logger.js";
import type { ItadApiClient } from "../util/itadApi.js";
import { ItadDealsCache } from "../util/itadDealsCache.js";
import {
  filterValidGameDeals,
  generateDealId,
  logGameDealRejections,
} from "../util/itadDeals.js";
import { getItadGameOverviews } from "../util/itadPrice.js";
import { resolveSteamAppIds } from "../util/steamAppIdResolver.js";
import type { SteamStoreApiClient } from "../util/steamStoreApi.js";
import { assessDeal, rankDeals, selectDealOfTheDay } from "./scoring.js";

export type DealRunStatus = "posted" | "no-deals" | "failed";

export interface DealRunSummary {
  status: DealRunStatus;
  fetched: number;
  qualified: number;
  posted: number;
}

export interface DealPipelineOptions {
  config: DealServiceConfig;
  itadClient: ItadApiClient;
  steamClient: SteamStoreApiClient;
  store: DealStore;
  poster: DealPoster;
  cache?: ItadDealsCache;
  logger?: DealLogger;
  now?: () => Date;
}

const NO_DEALS: DealRunSummary = {
  status: "no-deals",
  fetched: 0,
  qualified: 0,
  posted: 0,
};

function makePostingRecord(
  deal: ScoredDeal,
  country: string
): DealPostingRecord {
  const expiry = deal.deal.deal.expiry;
  const expiresAt = expiry === null ? null : new Date(expiry);

  return {
    gameId: deal.deal.id,
    shopId: deal.deal.deal.shop.id,
    title: deal.deal.title,
    shopName: deal.deal.deal.shop.name,
    url: deal.deal.deal.url,
    country,
    currency: deal.currency,
    currentPrice: deal.currentPrice,
    regularPrice: deal.regularPrice,
    discountPercent: deal.deal.deal.cut,
    historicalLowPrice: deal.historicalLowPrice,
    isHistoricalLow: deal.isHistoricalLow,
    isNewAllTimeLow: deal.isNewAllTimeLow,
    score: deal.score,
    scoreComponents: deal.scoreComponents,
    steamAppId: deal.steam.appId,
    steamReviewCount: deal.steam.totalReviews,
    metacriticScore: deal.steam.metacriticScore,
    expiresAt,
  };
}

export class DealPipeline {
  private readonly config: DealServiceConfig;
  private readonly itadClient: ItadApiClient;
  private readonly steamClient: SteamStoreApiClient;
  private readonly store: DealStore;
  private readonly poster: DealPoster;
  private readonly cache: ItadDealsCache;
  private readonly logger: DealLogger;
  private readonly now: () => Date;
  private activeRun: Promise<DealRunSummary> | null = null;

  constructor(options: DealPipelineOptions) {
    this.config = options.config;
    this.itadClient = options.itadClient;
    this.steamClient = options.steamClient;
    this.store = options.store;
    this.poster = options.poster;
    this.cache =
      options.cache ?? new ItadDealsCache(options.config.dealCacheTtlMs);
    this.logger = options.logger ?? dealLogger;
    this.now = options.now ?? (() => new Date());
  }

  run(): Promise<DealRunSummary> {
    if (this.activeRun) {
      this.logger.info("Deal pipeline run is already in progress");
      return this.activeRun;
    }

    this.activeRun = this.performRun().finally(() => {
      this.activeRun = null;
    });
    return this.activeRun;
  }

  private async performRun(): Promise<DealRunSummary> {
    try {
      return await this.performRunSafely();
    } catch (error) {
      this.logger.error("Deal pipeline failed; the scheduler will continue", {
        errorType: safeErrorName(error),
      });
      return { ...NO_DEALS, status: "failed" };
    }
  }

  private async performRunSafely(): Promise<DealRunSummary> {
    const runStartedAt = this.now();
    this.logger.info("Starting ITAD-to-Discord deal pipeline", {
      country: this.config.country,
      mode: this.config.mode,
    });

    // 1. Fetch ITAD's paginated deal list (15-minute TTL cache by default).
    const fetched = await this.cache.get(this.itadClient, {
      country: this.config.country,
      pageSize: this.config.itadDealsPageSize,
      maxPages: this.config.itadMaxDealPages,
      minDiscountPercent: this.config.minDiscountPercent,
      maxPrice: this.config.maxPrice,
      includeMature: this.config.includeMature,
    });
    const allDeals = this.cache.snapshotDeals(fetched);

    if (fetched.truncated) {
      this.logger.warn(
        "ITAD deal page limit reached; later pages were skipped",
        {
          pagesFetched: fetched.pagesFetched,
          nextOffset: fetched.nextOffset,
        }
      );
    }

    // 2. Reject DLC and packages before doing any further work.
    const gameFilter = filterValidGameDeals(
      allDeals,
      this.config.includeMature
    );
    logGameDealRejections(gameFilter.rejected, this.logger);
    if (gameFilter.deals.length === 0) {
      this.logger.info("No game deals remain after type and maturity filters");
      return { ...NO_DEALS, fetched: allDeals.length };
    }

    // 3. Remove offers already posted (dedupe key: ITAD game UUID + shop ID).
    const gameIds = [...new Set(gameFilter.deals.map((deal) => deal.id))];
    const postedOfferKeys = await this.store.getPostedOfferKeys(gameIds);
    const candidates = gameFilter.deals.filter(
      (deal) => !postedOfferKeys.has(generateDealId(deal))
    );
    if (candidates.length === 0) {
      this.logger.info(
        "All game offers in this ITAD result were already posted"
      );
      return { ...NO_DEALS, fetched: allDeals.length };
    }

    // 4. Fetch current prices and history before attempting Steam enrichment.
    const overviews = await getItadGameOverviews(
      this.itadClient,
      candidates.map((deal) => deal.id),
      this.config.country,
      this.config.allowVouchers
    );

    // 5. Resolve Steam AppIDs using ITAD's explicit shop mapping endpoint.
    const cachedMappings = await this.store.getSteamMappings(
      candidates.map((deal) => deal.id)
    );
    const resolutions = await resolveSteamAppIds(
      this.itadClient,
      candidates.map((deal) => deal.id),
      cachedMappings,
      this.config.itadSteamShopId,
      this.config.steamEnrichmentEnabled,
      this.logger
    );
    await this.store.saveSteamMappings(resolutions.mappings);

    if (resolutions.unresolvedGameIds.length > 0) {
      this.logger.info("Some ITAD games have no unambiguous Steam AppID", {
        unresolvedCount: resolutions.unresolvedGameIds.length,
        ambiguousCount: resolutions.ambiguousGameIds.length,
      });
    }

    // 6. Reuse fresh cached Steam appdetails and fetch the rest conservatively.
    const appIds = [...new Set(resolutions.mappings.values())];
    const steamCacheFreshAfter = new Date(
      runStartedAt.getTime() - this.config.steamCacheTtlMs
    );
    const cachedMetadata = await this.store.getSteamMetadata(
      appIds,
      steamCacheFreshAfter
    );
    const missingAppIds = appIds.filter((appId) => !cachedMetadata.has(appId));
    const fetchedMetadata = await this.steamClient.batchGetGameMetadata(
      missingAppIds,
      { country: this.config.country }
    );
    await this.store.saveSteamMetadata(fetchedMetadata, this.now());
    const steamMetadata = new Map([...cachedMetadata, ...fetchedMetadata]);

    // 7–8. Apply the full relevance gate, then score only qualifying deals.
    const scored: ScoredDeal[] = [];
    for (const deal of candidates) {
      const appId = resolutions.mappings.get(deal.id);
      const overview = overviews.get(deal.id) ?? null;
      const steam =
        appId === undefined ? null : (steamMetadata.get(appId) ?? null);
      const assessment = assessDeal(
        { deal, overview, steam },
        this.config,
        this.config.scoreWeights,
        runStartedAt,
        this.config.preferredPublishers
      );

      if (assessment.deal) {
        scored.push(assessment.deal);
      } else {
        this.logger.info("Deal rejected by relevance and price gates", {
          gameId: deal.id,
          rejectionReasons: assessment.rejectionReasons,
        });
      }
    }

    const ranked = rankDeals(scored);
    if (ranked.length === 0) {
      this.logger.info(
        "No deals met the configured relevance and price gates",
        {
          fetched: allDeals.length,
        }
      );
      return {
        status: "no-deals",
        fetched: allDeals.length,
        qualified: 0,
        posted: 0,
      };
    }

    // 9–11. Select, claim, post, and persist each successful message.
    let posted = 0;
    if (this.config.mode === "top") {
      const postedGames = new Set<string>();

      for (let index = 0; index < ranked.length; index += 1) {
        if (posted >= this.config.topCount) break;
        const deal = ranked[index];
        if (!deal || postedGames.has(deal.deal.id)) continue;

        const didPost = await this.postWithClaims(deal, "top", index + 1);
        if (didPost) {
          posted += 1;
          postedGames.add(deal.deal.id);
        }
      }
    } else {
      const cooledDownGameIds = await this.store.getCooledDownGameIds(
        [...new Set(ranked.map((deal) => deal.deal.id))],
        runStartedAt
      );
      const dealOfTheDay = selectDealOfTheDay(ranked, cooledDownGameIds);

      if (dealOfTheDay) {
        const rank = ranked.findIndex((deal) => deal === dealOfTheDay) + 1;
        if (await this.postWithClaims(dealOfTheDay, "deal-of-the-day", rank)) {
          posted = 1;
        }
      } else {
        this.logger.info(
          "No eligible deal remains outside the per-game cooldown"
        );
      }
    }

    if (posted === 0) {
      this.logger.info("No deals were posted in this run");
    }

    return {
      status: posted > 0 ? "posted" : "no-deals",
      fetched: allDeals.length,
      qualified: ranked.length,
      posted,
    };
  }

  private async postWithClaims(
    deal: ScoredDeal,
    placement: "top" | "deal-of-the-day",
    rank: number
  ): Promise<boolean> {
    const now = this.now();
    const claimToken = randomUUID();
    const gameId = deal.deal.id;
    const shopId = deal.deal.deal.shop.id;
    const dealKey = generateDealId(deal.deal);
    let offerClaimed = false;
    let dayClaimed = false;

    try {
      offerClaimed = await this.store.claimOffer(
        makePostingRecord(deal, this.config.country),
        claimToken,
        now,
        this.config.claimLeaseMs
      );
      if (!offerClaimed) {
        this.logger.info("Another run already claimed or posted this offer", {
          dealKey,
        });
        return false;
      }

      if (placement === "deal-of-the-day") {
        dayClaimed = await this.store.claimDealOfTheDay(
          gameId,
          claimToken,
          now,
          this.config.claimLeaseMs
        );
        if (!dayClaimed) {
          this.logger.info("Game is in cooldown or claimed by another run", {
            gameId,
          });
          await this.store.releaseOffer(gameId, shopId, claimToken);
          offerClaimed = false;
          return false;
        }
      }

      const message = await this.poster.post(deal, placement, rank);
      const dayClaim =
        placement === "deal-of-the-day"
          ? {
              claimToken,
              cooldownUntil: new Date(
                now.getTime() + this.config.cooldownDays * 24 * 60 * 60 * 1_000
              ),
            }
          : undefined;

      await this.store.markOfferPosted(
        gameId,
        shopId,
        claimToken,
        message,
        this.now(),
        dayClaim
      );
      offerClaimed = false;
      dayClaimed = false;
      return true;
    } catch (error) {
      this.logger.error("Could not post or persist a qualifying deal", {
        dealKey,
        placement,
        errorType: safeErrorName(error),
      });
      return false;
    } finally {
      if (offerClaimed) {
        await this.store
          .releaseOffer(gameId, shopId, claimToken)
          .catch((error: unknown) => {
            this.logger.warn("Could not release a deal offer claim", {
              dealKey,
              errorType: safeErrorName(error),
            });
          });
      }
      if (dayClaimed) {
        await this.store
          .releaseDealOfTheDay(gameId, claimToken)
          .catch((error: unknown) => {
            this.logger.warn("Could not release a deal-of-the-day claim", {
              gameId,
              errorType: safeErrorName(error),
            });
          });
      }
    }
  }
}
