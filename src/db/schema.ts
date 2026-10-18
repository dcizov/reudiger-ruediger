import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { DealScoreComponents } from "../types/deals.js";
import type { SteamGameMetadata } from "../schemas/steamStore.js";

export const postedDeals = pgTable(
  "posted_deals",
  {
    gameId: text("game_id").notNull(),
    shopId: integer("shop_id").notNull(),
    title: text("title").notNull(),
    shopName: text("shop_name").notNull(),
    url: text("url").notNull(),
    country: text("country").notNull(),
    currency: text("currency").notNull(),
    currentPrice: doublePrecision("current_price").notNull(),
    regularPrice: doublePrecision("regular_price").notNull(),
    discountPercent: integer("discount_percent").notNull(),
    historicalLowPrice: doublePrecision("historical_low_price"),
    isHistoricalLow: boolean("is_historical_low").notNull(),
    isNewAllTimeLow: boolean("is_new_all_time_low").notNull(),
    score: doublePrecision("score").notNull(),
    scoreComponents: jsonb("score_components")
      .$type<DealScoreComponents>()
      .notNull(),
    steamAppId: integer("steam_app_id").notNull(),
    steamReviewCount: integer("steam_review_count"),
    metacriticScore: integer("metacritic_score"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    claimToken: text("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true, mode: "date" }),
    messageId: text("message_id"),
    channelId: text("channel_id"),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.shopId] }),
    index("posted_deals_posted_at_idx").on(table.postedAt),
  ]
);

export const steamMappings = pgTable("steam_mappings", {
  gameId: text("game_id").primaryKey(),
  appId: integer("app_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const steamMetadataCache = pgTable("steam_metadata_cache", {
  appId: integer("app_id").primaryKey(),
  metadata: jsonb("metadata").$type<SteamGameMetadata>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const dealOfTheDay = pgTable(
  "deal_of_the_day",
  {
    gameId: text("game_id").primaryKey(),
    claimToken: text("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true, mode: "date" }),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "date" }),
    cooldownUntil: timestamp("cooldown_until", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [index("deal_of_the_day_cooldown_idx").on(table.cooldownUntil)]
);
