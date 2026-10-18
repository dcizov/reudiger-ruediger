import {
  ItadGameOverviewSchema,
  type ItadGameOverview,
} from "../schemas/itad.js";
import { ItadDealSchema, type ItadDeal } from "../schemas/itadDeals.js";
import type { SteamGameMetadata } from "../schemas/steamStore.js";
import type { DealCriteria, ScoredDeal } from "../types/deals.js";
import { assessDeal } from "../deals/scoring.js";

export const GAME_ID = "550e8400-e29b-41d4-a716-446655440000";
export const SECOND_GAME_ID = "550e8400-e29b-41d4-a716-446655440001";
export const FIXED_NOW = new Date("2026-10-19T10:00:00.000Z");

export const TEST_CRITERIA: DealCriteria = {
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
};

type ItadDealOverrides = Omit<Partial<ItadDeal>, "deal"> & {
  deal?: Omit<Partial<ItadDeal["deal"]>, "shop" | "price" | "regular"> & {
    shop?: Partial<ItadDeal["deal"]["shop"]>;
    price?: Partial<ItadDeal["deal"]["price"]>;
    regular?: Partial<ItadDeal["deal"]["regular"]>;
  };
};

export function makeItadDeal(overrides: ItadDealOverrides = {}): ItadDeal {
  const baseDetails = {
    shop: { id: 61, name: "Steam" },
    price: { amount: 10, currency: "EUR" },
    regular: { amount: 40, currency: "EUR" },
    cut: 75,
    voucher: null,
    storeLow: { amount: 8, currency: "EUR" },
    historyLow: { amount: 8, currency: "EUR" },
    historyLow_1y: { amount: 10, currency: "EUR" },
    historyLow_3m: { amount: 10, currency: "EUR" },
    flag: "N",
    drm: [{ id: 1, name: "Steam" }],
    platforms: [{ id: 1, name: "Windows" }],
    timestamp: "2026-10-19T09:00:00Z",
    expiry: "2026-10-20T09:00:00Z",
    url: "https://store.example.test/deal/game",
  };
  const dealOverrides = overrides.deal ?? {};
  const raw = {
    id: GAME_ID,
    slug: "test-game",
    title: "Test Game",
    type: "game",
    mature: false,
    assets: {
      banner600: "https://cdn.example.test/banner.jpg",
    },
    ...overrides,
    deal: {
      ...baseDetails,
      ...dealOverrides,
      shop: { ...baseDetails.shop, ...dealOverrides.shop },
      price: { ...baseDetails.price, ...dealOverrides.price },
      regular: { ...baseDetails.regular, ...dealOverrides.regular },
      storeLow:
        dealOverrides.storeLow === undefined
          ? baseDetails.storeLow
          : dealOverrides.storeLow,
      historyLow:
        dealOverrides.historyLow === undefined
          ? baseDetails.historyLow
          : dealOverrides.historyLow,
      historyLow_1y:
        dealOverrides.historyLow_1y === undefined
          ? baseDetails.historyLow_1y
          : dealOverrides.historyLow_1y,
      historyLow_3m:
        dealOverrides.historyLow_3m === undefined
          ? baseDetails.historyLow_3m
          : dealOverrides.historyLow_3m,
      drm: dealOverrides.drm ?? baseDetails.drm,
      platforms: dealOverrides.platforms ?? baseDetails.platforms,
    },
  };

  return ItadDealSchema.parse(raw);
}

export function makeOverview(
  deal: ItadDeal,
  overrides: {
    currentPrice?: number | null;
    lowestPrice?: number | null;
    currency?: string;
  } = {}
): ItadGameOverview {
  const currency = overrides.currency ?? deal.deal.price.currency;
  const currentPrice =
    overrides.currentPrice === undefined
      ? deal.deal.price.amount
      : overrides.currentPrice;
  const lowestPrice =
    overrides.lowestPrice === undefined ? 8 : overrides.lowestPrice;

  return ItadGameOverviewSchema.parse({
    id: deal.id,
    current:
      currentPrice === null
        ? null
        : {
            shop: deal.deal.shop,
            price: { amount: currentPrice, currency },
            regular: deal.deal.regular,
            cut: deal.deal.cut,
            voucher: deal.deal.voucher,
            flag: deal.deal.flag,
            drm: deal.deal.drm,
            platforms: deal.deal.platforms,
            timestamp: deal.deal.timestamp,
            expiry: deal.deal.expiry,
            url: deal.deal.url,
          },
    lowest:
      lowestPrice === null
        ? null
        : {
            shop: deal.deal.shop,
            price: { amount: lowestPrice, currency },
            regular: deal.deal.regular,
            cut: deal.deal.cut,
            timestamp: "2025-10-19T09:00:00Z",
          },
    bundled: 0,
    urls: { game: "https://isthereanydeal.com/game/test-game/" },
  });
}

export function makeSteamMetadata(
  overrides: Partial<SteamGameMetadata> = {}
): SteamGameMetadata {
  return {
    appId: 12345,
    name: "Test Game",
    type: "game",
    isFree: false,
    comingSoon: false,
    totalReviews: 5_000,
    metacriticScore: 85,
    headerImage: "https://cdn.example.test/steam-header.jpg",
    developers: ["Example Studio"],
    publishers: ["Example Publisher"],
    genres: ["Action", "Adventure"],
    releaseDate: "2024-01-01",
    ...overrides,
  };
}

export function makeScoredDeal(
  id = GAME_ID,
  overrides: {
    cut?: number;
    price?: number;
    regularPrice?: number;
    reviews?: number | null;
    metacritic?: number | null;
    publishers?: string[];
    historyLow?: number | null;
    flag?: "N" | "H" | "S" | null;
    title?: string;
  } = {}
): ScoredDeal {
  const deal = makeItadDeal({
    id,
    ...(overrides.title === undefined ? {} : { title: overrides.title }),
    deal: {
      cut: overrides.cut ?? 75,
      price: { amount: overrides.price ?? 10, currency: "EUR" },
      regular: { amount: overrides.regularPrice ?? 40, currency: "EUR" },
      historyLow:
        overrides.historyLow === undefined || overrides.historyLow === null
          ? null
          : { amount: overrides.historyLow, currency: "EUR" },
      flag: overrides.flag ?? "N",
    },
  });
  const overview = makeOverview(deal, {
    currentPrice: deal.deal.price.amount,
    lowestPrice: overrides.historyLow ?? 8,
  });
  const steam = makeSteamMetadata({
    totalReviews: overrides.reviews === undefined ? 5_000 : overrides.reviews,
    metacriticScore:
      overrides.metacritic === undefined ? 85 : overrides.metacritic,
    publishers: overrides.publishers ?? ["Example Publisher"],
  });
  const assessment = assessDeal(
    { deal, overview, steam },
    TEST_CRITERIA,
    undefined,
    FIXED_NOW
  );

  if (!assessment.deal) {
    throw new Error(
      `Fixture did not pass deal gates: ${assessment.rejectionReasons.join(", ")}`
    );
  }

  return assessment.deal;
}

export function mockedRequestUrl(input: string | URL | Request): URL {
  if (input instanceof Request) return new URL(input.url);
  if (input instanceof URL) return input;
  return new URL(input);
}
