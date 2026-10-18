import type {
  DealCriteria,
  DealFacts,
  DealScoreComponents,
  DealScoreWeights,
  ScoredDeal,
} from "../types/deals.js";

export const DEFAULT_SCORE_WEIGHTS: DealScoreWeights = {
  metacritic: 34,
  audienceDemand: 32,
  historicalValue: 14,
  discount: 8,
  regularPrice: 6,
  preferredPublisher: 6,
};

const PRICE_TOLERANCE = 0.02;
const MAX_NORMALIZED_REVIEW_COUNT = 1_000_000;
const REGULAR_PRICE_SCORE_CAP = 60;
const DISCOUNT_SCORE_CAP_PERCENT = 60;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function getQualityEvidence(facts: DealFacts, criteria: DealCriteria): boolean {
  const steam = facts.steam;
  if (!steam) return false;

  const enoughReviews =
    steam.totalReviews !== null &&
    steam.totalReviews >= criteria.minReviewCount;
  const enoughMetacritic =
    steam.metacriticScore !== null &&
    steam.metacriticScore >= criteria.minMetacriticScore;

  return enoughReviews || enoughMetacritic;
}

/**
 * Return every hard-gate rejection so a run can explain why a deal was
 * excluded. Review quality uses Metacritic and Steam's total recommendation
 * count only; no positive-review percentage is inferred.
 */
export function getHardFilterRejections(
  facts: DealFacts,
  criteria: DealCriteria,
  now: Date
): string[] {
  const reasons: string[] = [];
  const { deal, overview, steam } = facts;
  const offer = deal.deal;

  if (deal.type !== "game") reasons.push("not-a-game");
  if (deal.mature && !criteria.includeMature) {
    reasons.push("mature-content-disabled");
  }
  if (offer.voucher !== null && !criteria.allowVouchers) {
    reasons.push("voucher-required");
  }
  if (!safeHttpsUrl(offer.url)) reasons.push("unsafe-deal-url");

  if (
    offer.price.currency !== criteria.currency ||
    offer.regular.currency !== criteria.currency
  ) {
    reasons.push("offer-currency-mismatch");
  }
  if (offer.price.amount <= 0) reasons.push("free-or-zero-price");
  if (offer.price.amount > criteria.maxPrice) reasons.push("over-budget");
  if (offer.regular.amount < criteria.minRegularPrice) {
    reasons.push("regular-price-below-minimum");
  }
  if (offer.regular.amount <= offer.price.amount) {
    reasons.push("regular-price-not-above-sale-price");
  }
  if (offer.cut < criteria.minDiscountPercent) {
    reasons.push("discount-below-minimum");
  }

  if (offer.expiry !== null) {
    const expiry = Date.parse(offer.expiry);
    if (!Number.isFinite(expiry)) {
      reasons.push("invalid-expiry");
    } else if (expiry <= now.getTime()) {
      reasons.push("deal-expired");
    }
  }

  if (overview === null) {
    reasons.push("price-overview-unavailable");
  } else if (overview.current === null) {
    reasons.push("current-price-unavailable");
  } else {
    if (overview.current.price.currency !== criteria.currency) {
      reasons.push("overview-currency-mismatch");
    }

    if (
      overview.current.price.currency === criteria.currency &&
      offer.price.currency === criteria.currency &&
      offer.price.amount - overview.current.price.amount > PRICE_TOLERANCE
    ) {
      reasons.push("deal-is-not-current-best-price");
    }
  }

  if (steam === null) {
    reasons.push("steam-metadata-unavailable");
  } else {
    if (steam.type?.toLowerCase() !== "game") {
      reasons.push("steam-app-is-not-a-game");
    }
    if (steam.isFree === true) reasons.push("steam-game-is-free");
    else if (steam.isFree === null)
      reasons.push("steam-free-status-unavailable");
    if (steam.comingSoon === true) reasons.push("steam-game-not-yet-released");
    else if (steam.comingSoon === null) {
      reasons.push("steam-release-status-unavailable");
    }
    if (!getQualityEvidence(facts, criteria)) {
      reasons.push("insufficient-quality-evidence");
    }

    const actualGenres = new Set(steam.genres.map(normalize));
    const includedGenres = criteria.includedGenres
      .map(normalize)
      .filter(Boolean);
    const blockedGenres = criteria.blockedGenres.map(normalize).filter(Boolean);

    if (blockedGenres.some((genre) => actualGenres.has(genre))) {
      reasons.push("blocked-genre");
    }
    if (
      includedGenres.length > 0 &&
      !includedGenres.some((genre) => actualGenres.has(genre))
    ) {
      reasons.push("genre-not-in-allow-list");
    }
  }

  return [...new Set(reasons)];
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function scoreComponents(
  facts: DealFacts,
  historicalLowPrice: number | null,
  weights: DealScoreWeights,
  preferredPublishers: readonly string[]
): DealScoreComponents {
  const steam = facts.steam;
  const totalWeight =
    weights.metacritic +
    weights.audienceDemand +
    weights.historicalValue +
    weights.discount +
    weights.regularPrice +
    weights.preferredPublisher;

  if (totalWeight <= 0) {
    return {
      metacritic: 0,
      audienceDemand: 0,
      historicalValue: 0,
      discount: 0,
      regularPrice: 0,
      preferredPublisher: 0,
    };
  }

  const metacriticValue = (steam?.metacriticScore ?? 0) / 100;
  const reviewCount = steam?.totalReviews ?? 0;
  const demandValue =
    Math.log10(Math.max(0, reviewCount) + 1) /
    Math.log10(MAX_NORMALIZED_REVIEW_COUNT + 1);
  const currentPrice = facts.deal.deal.price.amount;
  const historicalValue =
    historicalLowPrice === null || currentPrice <= 0
      ? 0
      : historicalLowPrice / currentPrice;
  const discountValue = facts.deal.deal.cut / DISCOUNT_SCORE_CAP_PERCENT;
  const regularPriceValue =
    facts.deal.deal.regular.amount / REGULAR_PRICE_SCORE_CAP;
  const preferredPublisherSet = new Set(
    preferredPublishers.map(normalize).filter(Boolean)
  );
  const preferredPublisherValue = steam?.publishers.some((publisher) =>
    preferredPublisherSet.has(normalize(publisher))
  )
    ? 1
    : 0;

  const contribution = (weight: number, value: number): number =>
    roundScore((weight / totalWeight) * clamp(value) * 100);

  return {
    metacritic: contribution(weights.metacritic, metacriticValue),
    audienceDemand: contribution(weights.audienceDemand, demandValue),
    historicalValue: contribution(weights.historicalValue, historicalValue),
    discount: contribution(weights.discount, discountValue),
    regularPrice: contribution(weights.regularPrice, regularPriceValue),
    preferredPublisher: contribution(
      weights.preferredPublisher,
      preferredPublisherValue
    ),
  };
}

export interface DealAssessment {
  deal: ScoredDeal | null;
  rejectionReasons: string[];
}

export function assessDeal(
  facts: DealFacts,
  criteria: DealCriteria,
  weights: DealScoreWeights = DEFAULT_SCORE_WEIGHTS,
  now = new Date(),
  preferredPublishers: readonly string[] = []
): DealAssessment {
  const rejectionReasons = getHardFilterRejections(facts, criteria, now);
  if (rejectionReasons.length > 0 || !facts.overview || !facts.steam) {
    return { deal: null, rejectionReasons };
  }

  const offer = facts.deal.deal;
  const overviewLow = facts.overview.lowest;
  const historyPrice =
    overviewLow?.price.currency === criteria.currency
      ? overviewLow.price.amount
      : offer.historyLow?.currency === criteria.currency
        ? offer.historyLow.amount
        : null;

  const isNewAllTimeLow = offer.flag === "N";
  const isHistoricalLow =
    isNewAllTimeLow ||
    offer.flag === "H" ||
    (historyPrice !== null &&
      offer.price.amount <= historyPrice + PRICE_TOLERANCE);
  const components = scoreComponents(
    facts,
    historyPrice,
    weights,
    preferredPublishers
  );
  const score = roundScore(
    components.metacritic +
      components.audienceDemand +
      components.historicalValue +
      components.discount +
      components.regularPrice +
      components.preferredPublisher
  );

  return {
    deal: {
      deal: facts.deal,
      overview: facts.overview,
      steam: facts.steam,
      currentPrice: offer.price.amount,
      regularPrice: offer.regular.amount,
      currency: offer.price.currency,
      historicalLowPrice: historyPrice,
      isHistoricalLow,
      isNewAllTimeLow,
      score,
      scoreComponents: components,
    },
    rejectionReasons,
  };
}

export function getHumanReadableDealReasons(
  deal: ScoredDeal,
  criteria: DealCriteria,
  preferredPublishers: readonly string[] = []
): string[] {
  const reasons: string[] = [];
  const currencyFormat = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: deal.currency,
    maximumFractionDigits: 2,
  });

  if (deal.isNewAllTimeLow) {
    reasons.push("ITAD marks this as a new all-time low");
  } else if (deal.isHistoricalLow) {
    reasons.push("The current offer matches the historical low");
  }

  if (
    deal.steam.metacriticScore !== null &&
    deal.steam.metacriticScore >= criteria.minMetacriticScore
  ) {
    reasons.push(`Metacritic score: ${deal.steam.metacriticScore}/100`);
  }

  if (
    deal.steam.totalReviews !== null &&
    deal.steam.totalReviews >= criteria.minReviewCount
  ) {
    reasons.push(
      `${deal.steam.totalReviews.toLocaleString("en-US")} Steam recommendations`
    );
  }

  const preferredPublisherSet = new Set(
    preferredPublishers.map(normalize).filter(Boolean)
  );
  const matchedPublisher = deal.steam.publishers.find((publisher) =>
    preferredPublisherSet.has(normalize(publisher))
  );
  if (matchedPublisher)
    reasons.push(`Preferred publisher: ${matchedPublisher}`);

  reasons.push(
    `${deal.deal.deal.cut}% off its ${currencyFormat.format(deal.regularPrice)} regular price`
  );
  if (deal.historicalLowPrice !== null) {
    reasons.push(
      `Historical low: ${currencyFormat.format(deal.historicalLowPrice)}`
    );
  }

  return reasons.slice(0, 5);
}

export function rankDeals(deals: readonly ScoredDeal[]): ScoredDeal[] {
  return [...deals].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.isNewAllTimeLow !== right.isNewAllTimeLow) {
      return left.isNewAllTimeLow ? -1 : 1;
    }

    const leftReviews = left.steam.totalReviews ?? 0;
    const rightReviews = right.steam.totalReviews ?? 0;
    if (rightReviews !== leftReviews) return rightReviews - leftReviews;
    if (left.currentPrice !== right.currentPrice) {
      return left.currentPrice - right.currentPrice;
    }

    const titleOrder = left.deal.title
      .toLowerCase()
      .localeCompare(right.deal.title.toLowerCase(), "en");
    return titleOrder || left.deal.id.localeCompare(right.deal.id);
  });
}

export function selectTopDeals(
  rankedDeals: readonly ScoredDeal[],
  count: number,
  excludedGameIds: ReadonlySet<string> = new Set()
): ScoredDeal[] {
  if (count <= 0) return [];

  const selected: ScoredDeal[] = [];
  const seenGames = new Set(excludedGameIds);

  for (const deal of rankedDeals) {
    if (seenGames.has(deal.deal.id)) continue;
    selected.push(deal);
    seenGames.add(deal.deal.id);
    if (selected.length >= count) break;
  }

  return selected;
}

export function selectDealOfTheDay(
  rankedDeals: readonly ScoredDeal[],
  cooledDownGameIds: ReadonlySet<string>
): ScoredDeal | null {
  return (
    rankedDeals.find((deal) => !cooledDownGameIds.has(deal.deal.id)) ?? null
  );
}
