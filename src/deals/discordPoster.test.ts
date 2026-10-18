import { describe, expect, it } from "vitest";

import { makeScoredDeal, TEST_CRITERIA } from "../test/fixtures.js";
import type { DealServiceConfig } from "../types/deals.js";
import { buildDealEmbed, sanitizeDiscordText } from "./discordPoster.js";
import { DEFAULT_SCORE_WEIGHTS } from "./scoring.js";

const embedConfig: DealServiceConfig = {
  ...TEST_CRITERIA,
  country: "DE",
  mode: "top",
  topCount: 5,
  cooldownDays: 7,
  dealCacheTtlMs: 900_000,
  steamEnrichmentEnabled: true,
  steamCacheTtlMs: 86_400_000,
  steamRequestDelayMs: 0,
  itadDealsPageSize: 200,
  itadMaxDealPages: 2,
  itadSteamShopId: 61,
  claimLeaseMs: 120_000,
  preferredPublishers: ["Example Publisher"],
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
};

describe("Discord deal embeds", () => {
  it("uses the exact deal-of-the-day title and includes reasons, price, history, Steam, and ITAD details", () => {
    const deal = makeScoredDeal();
    const embed = buildDealEmbed(
      deal,
      "deal-of-the-day",
      1,
      embedConfig
    ).toJSON();

    expect(embed.title).toBe("Deal of the Day: Test Game");
    expect(embed.url).toBe("https://store.example.test/deal/game");
    expect(embed.description).toContain("Why this deal");
    expect(embed.description).toContain("new all-time low");
    expect(embed.fields?.map((field) => field.name)).toEqual(
      expect.arrayContaining([
        "Price",
        "Store",
        "Historical low",
        "Steam metadata",
        "Credits",
        "Platform / DRM",
        "Genres",
        "Deal URL",
      ])
    );
    expect(
      embed.fields?.find((field) => field.name === "Platform / DRM")?.value
    ).toContain("Windows");
    expect(embed.image?.url).toBe("https://cdn.example.test/steam-header.jpg");
    expect(embed.author?.name).toBe("IsThereAnyDeal");
    expect(embed.footer?.text).toContain("IsThereAnyDeal");
  });

  it("sanitizes control characters, mentions, markup, and long untrusted text", () => {
    const sanitized = sanitizeDiscordText("@everyone\n*hello* <script>");
    expect(sanitized).toContain("@\u200beveryone");
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("\\*hello\\*");
    expect(sanitizeDiscordText("x".repeat(20), 10)).toHaveLength(10);
  });

  it("prefers a safe ITAD image when the Steam header image is not HTTPS", () => {
    const deal = makeScoredDeal();
    deal.steam.headerImage = "http://insecure.example.test/steam.jpg";
    const embed = buildDealEmbed(deal, "top", 1, embedConfig).toJSON();

    expect(embed.image?.url).toBe("https://cdn.example.test/banner.jpg");
  });
});
