import { z } from "zod";

export const ItadPriceSchema = z
  .object({
    amount: z.number().finite().nonnegative(),
    amountInt: z.number().int().nonnegative().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .passthrough();

export const ItadShopSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1).max(160),
  })
  .passthrough();

export const ItadFlagSchema = z.enum(["N", "H", "S"]);

const ItadAssetMapSchema = z
  .object({
    banner600: z.string().url().optional(),
    banner400: z.string().url().optional(),
    banner300: z.string().url().optional(),
    boxart: z.string().url().optional(),
  })
  .passthrough();

const ItadDealDetailsSchema = z
  .object({
    shop: ItadShopSchema,
    price: ItadPriceSchema,
    regular: ItadPriceSchema,
    cut: z.number().int().min(0).max(100),
    voucher: z.string().max(256).nullable(),
    storeLow: ItadPriceSchema.nullable(),
    historyLow: ItadPriceSchema.nullable(),
    historyLow_1y: ItadPriceSchema.nullable(),
    historyLow_3m: ItadPriceSchema.nullable(),
    flag: ItadFlagSchema.nullable(),
    drm: z.array(ItadShopSchema),
    platforms: z.array(ItadShopSchema),
    timestamp: z.string().min(1),
    expiry: z.string().min(1).nullable(),
    url: z.string().url(),
  })
  .passthrough();

export const ItadDealSchema = z
  .object({
    id: z.uuid(),
    slug: z.string().min(1).max(512),
    title: z.string().trim().min(1).max(512),
    type: z.enum(["game", "dlc", "package"]).nullable(),
    mature: z.boolean().optional().default(false),
    assets: ItadAssetMapSchema.optional(),
    deal: ItadDealDetailsSchema,
  })
  .passthrough();

export const ItadDealsResponseSchema = z
  .object({
    nextOffset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    list: z.array(ItadDealSchema),
  })
  .passthrough();

export const ItadShopIdsResponseSchema = z.record(
  z.uuid(),
  z.array(z.string().min(1).max(128)).nullable()
);

export type ItadPrice = z.infer<typeof ItadPriceSchema>;
export type ItadShop = z.infer<typeof ItadShopSchema>;
export type ItadDeal = z.infer<typeof ItadDealSchema>;
export type ItadDealsResponse = z.infer<typeof ItadDealsResponseSchema>;
export type ItadShopIdsResponse = z.infer<typeof ItadShopIdsResponseSchema>;
