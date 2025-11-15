import { z } from 'zod';

/**
 * Zod schemas for IsThereAnyDeal (ITAD) /deals/v2 endpoint
 * Documentation: https://docs.isthereanydeal.com/
 */

// Price object schema
export const ItadPriceSchema = z.object({
  amount: z.number(),
  amountInt: z.number().int(),
  currency: z.string(),
});

// Shop object schema
export const ItadShopSchema = z.object({
  id: z.number(),
  name: z.string(),
});

// DRM object schema
export const ItadDrmSchema = z.object({
  id: z.number(),
  name: z.string(),
});

// Platform object schema
export const ItadPlatformSchema = z.object({
  id: z.number(),
  name: z.string(),
});

// Assets object schema
export const ItadAssetsSchema = z.object({
  banner145: z.string().optional(),
  banner300: z.string().optional(),
  banner400: z.string().optional(),
  banner600: z.string().optional(),
  boxart: z.string().optional(),
});

// Deal object schema
export const ItadDealObjectSchema = z.object({
  shop: ItadShopSchema,
  price: ItadPriceSchema,
  regular: ItadPriceSchema,
  cut: z.number().int().min(0).max(100), // Discount percentage (0-100)
  voucher: z.string().nullable(),
  storeLow: ItadPriceSchema.nullable(),
  historyLow: ItadPriceSchema.nullable(),
  historyLow_1y: ItadPriceSchema.nullable(),
  historyLow_3m: ItadPriceSchema.nullable(),
  flag: z.enum(['H', 'N', 'S']).nullable(), // H=Historical low, N=New, S=Special
  drm: z.array(ItadDrmSchema),
  platforms: z.array(ItadPlatformSchema),
  timestamp: z.string(), // ISO 8601 datetime
  expiry: z.string().nullable(), // ISO 8601 datetime or null
  url: z.string().url(),
});

// Individual deal item schema
export const ItadDealSchema = z.object({
  id: z.string(), // UUID
  slug: z.string(),
  title: z.string(),
  type: z.enum(['game', 'dlc', 'package']).nullable(),
  mature: z.boolean(),
  assets: ItadAssetsSchema,
  deal: ItadDealObjectSchema,
});

// Complete API response schema
export const ItadDealsResponseSchema = z.object({
  nextOffset: z.number().int().min(0),
  hasMore: z.boolean(),
  list: z.array(ItadDealSchema),
});

// Type exports
export type ItadPrice = z.infer<typeof ItadPriceSchema>;
export type ItadShop = z.infer<typeof ItadShopSchema>;
export type ItadDrm = z.infer<typeof ItadDrmSchema>;
export type ItadPlatform = z.infer<typeof ItadPlatformSchema>;
export type ItadAssets = z.infer<typeof ItadAssetsSchema>;
export type ItadDealObject = z.infer<typeof ItadDealObjectSchema>;
export type ItadDeal = z.infer<typeof ItadDealSchema>;
export type ItadDealsResponse = z.infer<typeof ItadDealsResponseSchema>;
