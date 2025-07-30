import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const postedDeals = pgTable("posted_deals", {
  id: serial("id").primaryKey(),
  dealId: varchar("deal_id", { length: 64 }).notNull().unique(),
  messageId: varchar("message_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  store: text("store").notNull(),
  platform: text("platform").notNull(),
  salePrice: varchar("sale_price", { length: 32 }),
  normalPrice: varchar("normal_price", { length: 32 }),
  savings: varchar("savings", { length: 16 }),
  dealRating: varchar("deal_rating", { length: 16 }),
  imageUrl: text("image_url"),
  url: text("url"),
  postedAt: timestamp("posted_at").defaultNow(),
  postedPrice: real("posted_price"),
  lowestEver: boolean("lowest_ever").default(false),
  historicalLow: real("historical_low"),
  expiresAt: timestamp("expires_at"),
});

export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  username: text("username").notNull(),
  gameId: varchar("game_id", { length: 128 }).notNull(),
  title: text("title").notNull(),
  historicalLow: integer("historical_low"), // Stored in cents for precision
  currentPrice: integer("current_price"),
  targetPrice: integer("target_price"),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().unique(),
  notificationsEnabled: boolean("notifications_enabled").default(true),
});
