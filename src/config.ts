import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const commaSeparatedList = z
  .string()
  .default("")
  .transform((value) => [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]);

const envSchema = z.object({
  DISCORD_TOKEN: z.string().trim().min(1),
  DISCORD_CLIENT_ID: z.string().trim().min(1),
  DISCORD_LOGIN_ENABLED: z.enum(["true", "false"]).default("true"),
  DISCORD_DEALS_CHANNEL_ID: z.string().trim().default(""),
  DATABASE_URL: z.string().trim().default(""),
  ITAD_API_KEY: z.string().trim().default(""),
  DEALS_ENABLED: z.enum(["true", "false"]).default("true"),
  DEALS_MODE: z.enum(["top", "deal-of-the-day"]).default("top"),
  DEALS_MAX_POSTS: z.coerce.number().int().min(1).max(20).default(5),
  DEALS_COOLDOWN_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  DEALS_SCHEDULE: z.string().trim().min(1).default("0 */6 * * *"),
  DEALS_TIMEZONE: z.string().trim().min(1).default("Europe/Berlin"),
  DEAL_MAX_PRICE: z.coerce.number().finite().min(0.01).max(10_000).default(60),
  DEAL_MIN_REGULAR_PRICE: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000)
    .default(10),
  DEAL_MIN_DISCOUNT_PERCENT: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .default(35),
  DEAL_MIN_STEAM_REVIEW_COUNT: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1_000),
  DEAL_MIN_METACRITIC_SCORE: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .default(70),
  DEAL_COUNTRY: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .default("DE"),
  DEAL_CURRENCY: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .default("EUR"),
  DEAL_INCLUDE_MATURE: z.enum(["true", "false"]).default("false"),
  DEAL_ALLOW_VOUCHERS: z.enum(["true", "false"]).default("false"),
  DEAL_INCLUDED_GENRES: commaSeparatedList,
  DEAL_BLOCKED_GENRES: commaSeparatedList,
  DEAL_PREFERRED_PUBLISHERS: commaSeparatedList,
  ITAD_DEALS_PAGE_SIZE: z.coerce.number().int().min(1).max(200).default(200),
  ITAD_MAX_DEAL_PAGES: z.coerce.number().int().min(1).max(20).default(2),
  ITAD_STEAM_SHOP_ID: z.coerce.number().int().positive().default(61),
  ITAD_DEAL_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(900),
  STEAM_ENRICHMENT_ENABLED: z.enum(["true", "false"]).default("true"),
  STEAM_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(2_592_000)
    .default(604_800),
  STEAM_REQUEST_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .default(2_000),
  DEAL_CLAIM_LEASE_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(3_600_000)
    .default(120_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const invalidFields = parsed.error.issues.map((issue) =>
    issue.path.length > 0 ? issue.path.join(".") : "environment"
  );
  console.error(
    `Invalid environment variables: ${[...new Set(invalidFields)].join(", ")}`
  );
  process.exit(1);
}

const env = parsed.data;

export const config = {
  DISCORD_TOKEN: env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
  discordLoginEnabled: env.DISCORD_LOGIN_ENABLED === "true",
  databaseUrl: env.DATABASE_URL,
  deals: {
    enabled: env.DEALS_ENABLED === "true",
    apiKey: env.ITAD_API_KEY,
    channelId: env.DISCORD_DEALS_CHANNEL_ID,
    schedule: env.DEALS_SCHEDULE,
    timezone: env.DEALS_TIMEZONE,
    mode: env.DEALS_MODE,
    topCount: env.DEALS_MAX_POSTS,
    cooldownDays: env.DEALS_COOLDOWN_DAYS,
    criteria: {
      maxPrice: env.DEAL_MAX_PRICE,
      minRegularPrice: env.DEAL_MIN_REGULAR_PRICE,
      minDiscountPercent: env.DEAL_MIN_DISCOUNT_PERCENT,
      minReviewCount: env.DEAL_MIN_STEAM_REVIEW_COUNT,
      minMetacriticScore: env.DEAL_MIN_METACRITIC_SCORE,
      country: env.DEAL_COUNTRY.toUpperCase(),
      currency: env.DEAL_CURRENCY.toUpperCase(),
      includeMature: env.DEAL_INCLUDE_MATURE === "true",
      allowVouchers: env.DEAL_ALLOW_VOUCHERS === "true",
      includedGenres: env.DEAL_INCLUDED_GENRES,
      blockedGenres: env.DEAL_BLOCKED_GENRES,
      preferredPublishers: env.DEAL_PREFERRED_PUBLISHERS,
    },
    dealCacheTtlMs: env.ITAD_DEAL_CACHE_TTL_SECONDS * 1_000,
    steamEnrichmentEnabled: env.STEAM_ENRICHMENT_ENABLED === "true",
    steamCacheTtlMs: env.STEAM_CACHE_TTL_SECONDS * 1_000,
    steamRequestDelayMs: env.STEAM_REQUEST_DELAY_MS,
    itadDealsPageSize: env.ITAD_DEALS_PAGE_SIZE,
    itadMaxDealPages: env.ITAD_MAX_DEAL_PAGES,
    itadSteamShopId: env.ITAD_STEAM_SHOP_ID,
    claimLeaseMs: env.DEAL_CLAIM_LEASE_MS,
  },
};

export type AppConfig = typeof config;
