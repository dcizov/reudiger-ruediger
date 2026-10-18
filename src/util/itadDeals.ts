import type { ItadDeal } from "../schemas/itadDeals.js";
import type { DealLogger } from "../types/deals.js";
import { dealLogger } from "./logger.js";
import type { ItadApiClient } from "./itadApi.js";

export interface FetchItadDealsOptions {
  country: string;
  pageSize: number;
  maxPages: number;
  minDiscountPercent: number;
  maxPrice: number;
  includeMature: boolean;
}

export interface FetchItadDealsResult {
  deals: ItadDeal[];
  pagesFetched: number;
  truncated: boolean;
  nextOffset: number | null;
}

export interface GameDealFilterRejection {
  deal: ItadDeal;
  reasons: string[];
}

export interface GameDealFilterResult {
  deals: ItadDeal[];
  rejected: GameDealFilterRejection[];
}

export async function fetchItadDeals(
  client: ItadApiClient,
  options: FetchItadDealsOptions
): Promise<FetchItadDealsResult> {
  const deals: ItadDeal[] = [];
  const seenOffsets = new Set<number>();
  let offset = 0;
  let pagesFetched = 0;
  let hasMore = true;

  while (hasMore && pagesFetched < options.maxPages) {
    if (seenOffsets.has(offset)) {
      throw new Error("ITAD pagination returned a repeated offset");
    }
    seenOffsets.add(offset);

    const page = await client.getDealsPage({
      country: options.country,
      offset,
      limit: options.pageSize,
      mature: options.includeMature,
      sort: "-cut",
      filter: {
        type: [1],
        cut: { min: options.minDiscountPercent, max: null },
        price: { min: 0, max: options.maxPrice },
      },
    });

    deals.push(...page.list);
    pagesFetched += 1;
    hasMore = page.hasMore;

    if (!hasMore) break;
    if (page.nextOffset <= offset) {
      throw new Error("ITAD pagination did not advance to the next offset");
    }
    offset = page.nextOffset;
  }

  return {
    deals,
    pagesFetched,
    truncated: hasMore,
    nextOffset: hasMore ? offset : null,
  };
}

export function filterValidGameDeals(
  deals: readonly ItadDeal[],
  includeMature = false
): GameDealFilterResult {
  const valid: ItadDeal[] = [];
  const rejected: GameDealFilterRejection[] = [];

  for (const deal of deals) {
    const reasons: string[] = [];
    if (deal.type !== "game") reasons.push("not-a-game");
    if (deal.mature && !includeMature) reasons.push("mature-content-disabled");

    if (reasons.length > 0) {
      rejected.push({ deal, reasons });
    } else {
      valid.push(deal);
    }
  }

  return { deals: valid, rejected };
}

export function generateDealId(deal: {
  id: string;
  deal: { shop: { id: number } };
}): string {
  return `${deal.id}-${deal.deal.shop.id}`;
}

export function logGameDealRejections(
  rejected: readonly GameDealFilterRejection[],
  logger: DealLogger = dealLogger
): void {
  for (const item of rejected) {
    logger.info("Deal rejected by game-type filters", {
      gameId: item.deal.id,
      title: item.deal.title,
      reasons: item.reasons,
    });
  }
}
