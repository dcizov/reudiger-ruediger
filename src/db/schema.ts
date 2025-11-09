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
  (table) => ({
    expiresAtIdx: index('posted_deals_expires_at_idx').on(table.expiresAt),
  }),
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
    historicalLow: integer('historical_low'), // Stored in cents for precision
    currentPrice: integer('current_price'),
    targetPrice: integer('target_price'),
    notified: boolean('notified').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    gameIdIdx: index('subscriptions_game_id_idx').on(table.gameId),
    userGameUnique: uniqueIndex('subscriptions_user_game_unique').on(
      table.userId,
      table.gameId,
    ),
  }),
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
  category: varchar('category', { length: 100 }), // For role grouping (e.g., "Gaming", "Access")
  requiresExistingRoles: boolean('requires_existing_roles').default(false), // Dev role logic
  required: boolean('required').default(false), // Members role can't be toggled off
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
  (table) => ({
    userGuildUnique: uniqueIndex('user_role_cooldowns_user_guild_unique').on(
      table.userId,
      table.guildId,
    ),
  }),
);
