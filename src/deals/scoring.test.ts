import { describe, expect, it } from "vitest";

import {
  assessDeal,
  DEFAULT_SCORE_WEIGHTS,
  getHardFilterRejections,
  getHumanReadableDealReasons,
  rankDeals,
  selectDealOfTheDay,
  selectTopDeals,
} from "./scoring.js";
import { generateDealId } from "../util/itadDeals.js";
import {
  FIXED_NOW,
  GAME_ID,
  SECOND_GAME_ID,
  makeItadDeal,
  makeOverview,
  makeScoredDeal,
  makeSteamMetadata,
  TEST_CRITERIA,
} from "../test/fixtures.js";

function facts(
  deal = makeItadDeal(),
  steam = makeSteamMetadata(),
  overview = makeOverview(deal)
) {
  return { deal, overview, steam };
}

describe("deal relevance gates", () => {
  it("accepts a valid €10–€60 game deal with either quality signal", () => {
    const reviewQualified = facts(
      makeItadDeal(),
      makeSteamMetadata({ totalReviews: 1_000, metacriticScore: null })
    );
    expect(
      getHardFilterRejections(reviewQualified, TEST_CRITERIA, FIXED_NOW)
    ).toEqual([]);

    const metacriticQualified = facts(
      makeItadDeal(),
      makeSteamMetadata({ totalReviews: 999, metacriticScore: 70 })
    );
    expect(
      getHardFilterRejections(metacriticQualified, TEST_CRITERIA, FIXED_NOW)
    ).toEqual([]);
  });

  it("rejects DLC, packages, mature content, and Steam non-games", () => {
    expect(
      getHardFilterRejections(
        facts(makeItadDeal({ type: "dlc" })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("not-a-game");

    expect(
      getHardFilterRejections(
        facts(makeItadDeal({ mature: true })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("mature-content-disabled");

    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), makeSteamMetadata({ type: "dlc" })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("steam-app-is-not-a-game");
  });

  it("rejects free-to-play, unreleased, and poorly evidenced games", () => {
    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), makeSteamMetadata({ isFree: true })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("steam-game-is-free");

    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), makeSteamMetadata({ comingSoon: true })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("steam-game-not-yet-released");
    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), makeSteamMetadata({ isFree: null })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("steam-free-status-unavailable");
    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), makeSteamMetadata({ comingSoon: null })),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("steam-release-status-unavailable");

    const insufficient = facts(
      makeItadDeal(),
      makeSteamMetadata({ totalReviews: 999, metacriticScore: 69 })
    );
    expect(
      getHardFilterRejections(insufficient, TEST_CRITERIA, FIXED_NOW)
    ).toContain("insufficient-quality-evidence");
  });

  it("does not depend on positive-review ratio data", () => {
    const steam = makeSteamMetadata({
      totalReviews: 1_000,
      metacriticScore: null,
    });
    expect("positiveReviewPercentage" in steam).toBe(false);
    expect(
      getHardFilterRejections(
        facts(makeItadDeal(), steam),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toEqual([]);
  });

  it("enforces price, currency, discount, expiry, and current-best-price gates", () => {
    const tooExpensive = makeItadDeal({
      deal: { price: { amount: 60.01, currency: "EUR" } },
    });
    expect(
      getHardFilterRejections(facts(tooExpensive), TEST_CRITERIA, FIXED_NOW)
    ).toContain("over-budget");

    const regularUnderTen = makeItadDeal({
      deal: {
        regular: { amount: 9.99, currency: "EUR" },
        price: { amount: 5, currency: "EUR" },
      },
    });
    expect(
      getHardFilterRejections(facts(regularUnderTen), TEST_CRITERIA, FIXED_NOW)
    ).toContain("regular-price-below-minimum");

    const wrongCurrency = makeItadDeal({
      deal: {
        price: { amount: 10, currency: "USD" },
        regular: { amount: 40, currency: "USD" },
      },
    });
    expect(
      getHardFilterRejections(facts(wrongCurrency), TEST_CRITERIA, FIXED_NOW)
    ).toContain("offer-currency-mismatch");

    const smallDiscount = makeItadDeal({ deal: { cut: 34 } });
    expect(
      getHardFilterRejections(facts(smallDiscount), TEST_CRITERIA, FIXED_NOW)
    ).toContain("discount-below-minimum");

    const expired = makeItadDeal({
      deal: { expiry: "2020-01-01T00:00:00Z" },
    });
    expect(
      getHardFilterRejections(facts(expired), TEST_CRITERIA, FIXED_NOW)
    ).toContain("deal-expired");

    const noLongerCurrent = makeItadDeal();
    expect(
      getHardFilterRejections(
        facts(
          noLongerCurrent,
          makeSteamMetadata(),
          makeOverview(noLongerCurrent, { currentPrice: 8 })
        ),
        TEST_CRITERIA,
        FIXED_NOW
      )
    ).toContain("deal-is-not-current-best-price");
  });

  it("applies optional genre allow and block lists case-insensitively", () => {
    const validFacts = facts();
    expect(
      getHardFilterRejections(
        validFacts,
        { ...TEST_CRITERIA, includedGenres: ["action"] },
        FIXED_NOW
      )
    ).toEqual([]);
    expect(
      getHardFilterRejections(
        validFacts,
        { ...TEST_CRITERIA, includedGenres: ["RPG"] },
        FIXED_NOW
      )
    ).toContain("genre-not-in-allow-list");
    expect(
      getHardFilterRejections(
        validFacts,
        { ...TEST_CRITERIA, blockedGenres: ["action"] },
        FIXED_NOW
      )
    ).toContain("blocked-genre");
  });
});

describe("deal scoring and selection", () => {
  it("uses quality, logarithmic demand, historical value, discount, price, and publisher components", () => {
    const assessment = assessDeal(
      facts(),
      TEST_CRITERIA,
      DEFAULT_SCORE_WEIGHTS,
      FIXED_NOW,
      ["Example Publisher"]
    );
    expect(assessment.deal).not.toBeNull();
    if (!assessment.deal)
      throw new Error("Expected the fixture deal to qualify");

    const components = assessment.deal.scoreComponents;
    expect(Object.keys(components).sort()).toEqual([
      "audienceDemand",
      "discount",
      "historicalValue",
      "metacritic",
      "preferredPublisher",
      "regularPrice",
    ]);
    for (const value of [
      components.metacritic,
      components.audienceDemand,
      components.historicalValue,
      components.discount,
      components.regularPrice,
      components.preferredPublisher,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(components.preferredPublisher).toBeGreaterThan(0);
    expect(assessment.deal.score).toBeGreaterThan(0);
    expect(assessment.deal.score).toBeLessThanOrEqual(100);
  });

  it("caps the discount and regular-price contributions", () => {
    const sixtyPercent = makeScoredDeal(GAME_ID, { cut: 60, flag: "S" });
    const oneHundredPercent = makeScoredDeal(GAME_ID, { cut: 100, flag: "S" });
    expect(sixtyPercent.scoreComponents.discount).toBe(
      oneHundredPercent.scoreComponents.discount
    );

    const sixtyEuroListPrice = makeScoredDeal(GAME_ID, { regularPrice: 60 });
    const threeHundredEuroListPrice = makeScoredDeal(GAME_ID, {
      regularPrice: 300,
    });
    expect(sixtyEuroListPrice.scoreComponents.regularPrice).toBe(
      threeHundredEuroListPrice.scoreComponents.regularPrice
    );
  });

  it("uses logarithmic review-count scaling instead of linear count", () => {
    const oneThousandReviews = makeScoredDeal(GAME_ID, {
      reviews: 1_000,
      metacritic: 85,
      flag: "S",
    });
    const tenThousandReviews = makeScoredDeal(GAME_ID, {
      reviews: 10_000,
      metacritic: 85,
      flag: "S",
    });
    const oneHundredThousandReviews = makeScoredDeal(GAME_ID, {
      reviews: 100_000,
      metacritic: 85,
      flag: "S",
    });
    const firstStep =
      tenThousandReviews.scoreComponents.audienceDemand -
      oneThousandReviews.scoreComponents.audienceDemand;
    const secondStep =
      oneHundredThousandReviews.scoreComponents.audienceDemand -
      tenThousandReviews.scoreComponents.audienceDemand;

    expect(firstStep).toBeGreaterThan(0);
    expect(secondStep).toBeGreaterThan(0);
    expect(Math.abs(firstStep - secondStep)).toBeLessThan(0.5);
  });

  it("produces human-readable reasons without inventing review quality", () => {
    const deal = makeScoredDeal(GAME_ID, {
      reviews: 1_234,
      metacritic: 82,
      publishers: ["Example Publisher"],
    });
    const reasons = getHumanReadableDealReasons(deal, TEST_CRITERIA, [
      "Example Publisher",
    ]);

    expect(reasons).toContain("ITAD marks this as a new all-time low");
    expect(reasons).toContain("Metacritic score: 82/100");
    expect(reasons).toContain("1,234 Steam recommendations");
    expect(reasons).toContain("Preferred publisher: Example Publisher");
  });

  it("creates the dedupe key from ITAD game UUID and shop ID", () => {
    expect(generateDealId(makeItadDeal())).toBe(`${GAME_ID}-61`);
  });

  it("ranks deterministically and selects top or non-cooled-down daily deals", () => {
    const first = makeScoredDeal(GAME_ID, { title: "Alpha" });
    const second = makeScoredDeal(SECOND_GAME_ID, { title: "Bravo" });
    const ranked = rankDeals([second, first]);

    expect(ranked.map((deal) => deal.deal.title)).toEqual(["Alpha", "Bravo"]);
    expect(selectTopDeals(ranked, 1)).toEqual([first]);
    expect(selectTopDeals(ranked, 2, new Set([GAME_ID]))).toEqual([second]);
    expect(selectDealOfTheDay(ranked, new Set([GAME_ID]))?.deal.id).toBe(
      SECOND_GAME_ID
    );
    expect(
      selectDealOfTheDay(ranked, new Set([GAME_ID, SECOND_GAME_ID]))
    ).toBeNull();
  });
});
