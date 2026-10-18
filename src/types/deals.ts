import type { ItadGameOverview } from "../schemas/itad.js";
import type { ItadDeal } from "../schemas/itadDeals.js";
import type { SteamGameMetadata } from "../schemas/steamStore.js";

export type DealReportingMode = "top" | "deal-of-the-day";
export type DealPlacement = DealReportingMode;

export interface DealCriteria {
  maxPrice: number;
  minRegularPrice: number;
  currency: string;
  minDiscountPercent: number;
  minReviewCount: number;
  minMetacriticScore: number;
  includeMature: boolean;
  allowVouchers: boolean;
  includedGenres: readonly string[];
  blockedGenres: readonly string[];
}

export interface DealScoreWeights {
  metacritic: number;
  audienceDemand: number;
  historicalValue: number;
  discount: number;
  regularPrice: number;
  preferredPublisher: number;
}

export interface DealScoreComponents {
  metacritic: number;
  audienceDemand: number;
  historicalValue: number;
  discount: number;
  regularPrice: number;
  preferredPublisher: number;
}

export interface DealFacts {
  deal: ItadDeal;
  overview: ItadGameOverview | null;
  steam: SteamGameMetadata | null;
}

export interface ScoredDeal {
  deal: ItadDeal;
  overview: ItadGameOverview;
  steam: SteamGameMetadata;
  currentPrice: number;
  regularPrice: number;
  currency: string;
  historicalLowPrice: number | null;
  isHistoricalLow: boolean;
  isNewAllTimeLow: boolean;
  score: number;
  scoreComponents: DealScoreComponents;
}

export interface DealServiceConfig extends DealCriteria {
  country: string;
  mode: DealReportingMode;
  topCount: number;
  cooldownDays: number;
  dealCacheTtlMs: number;
  steamEnrichmentEnabled: boolean;
  steamCacheTtlMs: number;
  steamRequestDelayMs: number;
  itadDealsPageSize: number;
  itadMaxDealPages: number;
  itadSteamShopId: number;
  claimLeaseMs: number;
  preferredPublishers: readonly string[];
  scoreWeights: DealScoreWeights;
}

export interface DealPostingRecord {
  gameId: string;
  shopId: number;
  title: string;
  shopName: string;
  url: string;
  country: string;
  currency: string;
  currentPrice: number;
  regularPrice: number;
  discountPercent: number;
  historicalLowPrice: number | null;
  isHistoricalLow: boolean;
  isNewAllTimeLow: boolean;
  score: number;
  scoreComponents: DealScoreComponents;
  steamAppId: number;
  steamReviewCount: number | null;
  metacriticScore: number | null;
  expiresAt: Date | null;
}

export interface DealMessageReference {
  messageId: string;
  channelId: string;
}

export interface DealOfTheDayClaim {
  claimToken: string;
  cooldownUntil: Date;
}

export interface DealLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface DealStore {
  getPostedOfferKeys(gameIds: readonly string[]): Promise<Set<string>>;
  getCooledDownGameIds(
    gameIds: readonly string[],
    now: Date
  ): Promise<Set<string>>;
  getSteamMappings(gameIds: readonly string[]): Promise<Map<string, number>>;
  saveSteamMappings(mappings: ReadonlyMap<string, number>): Promise<void>;
  getSteamMetadata(
    appIds: readonly number[],
    freshAfter: Date
  ): Promise<Map<number, SteamGameMetadata>>;
  saveSteamMetadata(
    metadata: ReadonlyMap<number, SteamGameMetadata>,
    updatedAt: Date
  ): Promise<void>;
  claimOffer(
    record: DealPostingRecord,
    claimToken: string,
    now: Date,
    leaseMs: number
  ): Promise<boolean>;
  markOfferPosted: (
    gameId: string,
    shopId: number,
    claimToken: string,
    message: DealMessageReference,
    postedAt: Date,
    dealOfTheDay?: DealOfTheDayClaim
  ) => Promise<void>;
  releaseOffer(
    gameId: string,
    shopId: number,
    claimToken: string
  ): Promise<void>;
  claimDealOfTheDay: (
    gameId: string,
    claimToken: string,
    now: Date,
    leaseMs: number
  ) => Promise<boolean>;
  releaseDealOfTheDay(gameId: string, claimToken: string): Promise<void>;
}

export interface DealPoster {
  post: (
    deal: ScoredDeal,
    placement: DealPlacement,
    rank: number
  ) => Promise<DealMessageReference>;
}
