import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

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
});

export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
