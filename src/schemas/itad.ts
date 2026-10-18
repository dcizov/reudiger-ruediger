import { z } from "zod";

import {
  ItadFlagSchema,
  ItadPriceSchema,
  ItadShopSchema,
} from "./itadDeals.js";

const ItadOverviewDealSchema = z
  .object({
    shop: ItadShopSchema,
    price: ItadPriceSchema,
    regular: ItadPriceSchema,
    cut: z.number().int().min(0).max(100),
    voucher: z.string().max(256).nullable(),
    flag: ItadFlagSchema.nullable(),
    drm: z.array(ItadShopSchema),
    platforms: z.array(ItadShopSchema),
    timestamp: z.string().min(1),
    expiry: z.string().min(1).nullable(),
    url: z.string().url(),
  })
  .passthrough();

const ItadHistoricalLowSchema = z
  .object({
    shop: ItadShopSchema,
    price: ItadPriceSchema,
    regular: ItadPriceSchema,
    cut: z.number().int().min(0).max(100),
    timestamp: z.string().min(1),
  })
  .passthrough();

export const ItadGameOverviewSchema = z
  .object({
    id: z.uuid(),
    current: ItadOverviewDealSchema.nullable(),
    lowest: ItadHistoricalLowSchema.nullable(),
    bundled: z.number().int().nonnegative(),
    urls: z.object({ game: z.string().url() }).passthrough(),
  })
  .passthrough();

export const ItadOverviewResponseSchema = z
  .object({
    prices: z.array(ItadGameOverviewSchema),
    bundles: z.array(z.unknown()),
  })
  .passthrough();

export type ItadGameOverview = z.infer<typeof ItadGameOverviewSchema>;
export type ItadOverviewResponse = z.infer<typeof ItadOverviewResponseSchema>;
