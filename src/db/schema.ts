import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const postedDeals = pgTable(
  'posted_deals',
  {
    id: serial('id').primaryKey(),
    dealId: varchar('deal_id', { length: 64 }).notNull().unique(),
    messageId: varchar('message_id', { length: 64 }).notNull(),
    title: text('title').notNull(),
    store: text('store').notNull(),
    platform: text('platform').notNull(),
    salePrice: varchar('sale_price', { length: 32 }),
    normalPrice: varchar('normal_price', { length: 32 }),
    savings: varchar('savings', { length: 16 }),
    dealRating: varchar('deal_rating', { length: 16 }),
    imageUrl: text('image_url'),
    url: text('url'),
    postedAt: timestamp('posted_at').defaultNow(),
    postedPrice: real('posted_price'),
    lowestEver: boolean('lowest_ever').default(false),
    historicalLow: real('historical_low'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [index('posted_deals_expires_at_idx').on(table.expiresAt)],
);

export const botConfig = pgTable('bot_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    username: text('username').notNull(),
    gameId: varchar('game_id', { length: 128 }).notNull(),
    title: text('title').notNull(),
    historicalLow: integer('historical_low'),
    currentPrice: integer('current_price'),
    targetPrice: integer('target_price'),
    notified: boolean('notified').default(false),
    steamAppId: integer('steam_app_id'), // Steam app ID for Steam-based price tracking
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('subscriptions_user_id_idx').on(table.userId),
    index('subscriptions_game_id_idx').on(table.gameId),
    uniqueIndex('subscriptions_user_game_unique').on(
      table.userId,
      table.gameId,
    ),
  ],
);

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().unique(),
  notificationsEnabled: boolean('notifications_enabled').default(true),
});

export const reactionRoles = pgTable('reaction_roles', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 255 }).notNull().unique(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  guildId: varchar('guild_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reactionRoleButtons = pgTable('reaction_role_buttons', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 255 })
    .notNull()
    .references(() => reactionRoles.messageId, { onDelete: 'cascade' }),
  roleId: varchar('role_id', { length: 255 }).notNull(),
  emoji: varchar('emoji', { length: 100 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  buttonId: varchar('button_id', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 100 }),
  requiresExistingRoles: boolean('requires_existing_roles').default(false),
  required: boolean('required').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRoleCooldowns = pgTable(
  'user_role_cooldowns',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    lastChanged: timestamp('last_changed').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_role_cooldowns_user_guild_unique').on(
      table.userId,
      table.guildId,
    ),
  ],
);

export const newsSettings = pgTable(
  'news_settings',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    source: text('source').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    channelId: varchar('channel_id', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('news_settings_guild_source_unique').on(
      table.guildId,
      table.source,
    ),
  ],
);

export const postedNews = pgTable(
  'posted_news',
  {
    id: serial('id').primaryKey(),
    guid: text('guid').notNull(),
    source: text('source').notNull(),
    guildId: text('guild_id').notNull(),
    messageId: varchar('message_id', { length: 255 }),
    title: text('title'),
    postedAt: timestamp('posted_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('posted_news_guid_guild_unique').on(table.guid, table.guildId),
    index('posted_news_guild_id_idx').on(table.guildId),
    index('posted_news_source_idx').on(table.source),
    index('posted_news_posted_at_idx').on(table.postedAt),
  ],
);

// ============================================================================
// Steam Web API Integration Tables
// ============================================================================

/**
 * Steam App Cache - Caches Steam game metadata to reduce API calls
 * Stores detailed game information from Steam Store API
 * TTL: Games should be re-fetched when lastUpdated > 24 hours old
 */
export const steamAppCache = pgTable(
  'steam_app_cache',
  {
    id: serial('id').primaryKey(),
    appId: integer('app_id').notNull().unique(),
    name: text('name').notNull(),
    type: text('type'), // 'game', 'dlc', 'demo', etc.
    headerImage: text('header_image'),
    shortDescription: text('short_description'),
    developers: text('developers'), // JSON array stored as string
    publishers: text('publishers'), // JSON array stored as string
    releaseDate: text('release_date'),
    isFree: boolean('is_free'),
    metacriticScore: integer('metacritic_score'), // 0-100
    lastUpdated: timestamp('last_updated').notNull().defaultNow(),
  },
  (table) => [
    index('steam_app_cache_name_idx').on(table.name),
    index('steam_app_cache_last_updated_idx').on(table.lastUpdated),
  ],
);

/**
 * Steam Profiles - Links Discord users to their Steam accounts
 * Enables /steam profile, /library, and other Steam-based features
 * One Discord user can link one Steam account
 */
export const steamProfiles = pgTable(
  'steam_profiles',
  {
    id: serial('id').primaryKey(),
    discordUserId: varchar('discord_user_id', { length: 64 })
      .notNull()
      .unique(),
    steamId: varchar('steam_id', { length: 64 }).notNull().unique(),
    personaName: text('persona_name'),
    profileUrl: text('profile_url'),
    avatar: text('avatar'),
    isPublic: boolean('is_public').default(false),
    lastSynced: timestamp('last_synced').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('steam_profiles_discord_user_idx').on(table.discordUserId),
    index('steam_profiles_steam_id_idx').on(table.steamId),
  ],
);

/**
 * Steam Wishlists - User wishlists with price alert functionality
 * Users can add Steam games and get notified when prices drop
 * Max 20 items per user (enforced in application logic)
 */
export const steamWishlists = pgTable(
  'steam_wishlists',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    steamAppId: integer('steam_app_id').notNull(),
    gameName: text('game_name').notNull(),
    addedPrice: integer('added_price'), // Price in cents when added
    targetPrice: integer('target_price'), // Alert when price drops below (cents)
    notified: boolean('notified').default(false).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('steam_wishlists_user_id_idx').on(table.userId),
    index('steam_wishlists_steam_app_id_idx').on(table.steamAppId),
    uniqueIndex('steam_wishlists_user_app_unique').on(
      table.userId,
      table.steamAppId,
    ),
  ],
);
