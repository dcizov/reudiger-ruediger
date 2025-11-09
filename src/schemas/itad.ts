import { z } from 'zod';

const PriceDetailSchema = z.object({
  amount: z.number(),
  amountInt: z.number(),
  currency: z.string(),
});

const ShopSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const ItadLookupResponseSchema = z.object({
  found: z.boolean(),
  game: z
    .object({
      id: z.string(),
    })
    .optional(),
});

export const ItadPricesResponseSchema = z.array(
  z.object({
    id: z.string(),
    deals: z.array(
      z.object({
        shop: ShopSchema,
        price: PriceDetailSchema,
        regular: PriceDetailSchema,
        url: z.string(),
      }),
    ),
  }),
);

export const ItadOverviewResponseSchema = z.object({
  prices: z.array(
    z.object({
      id: z.string(),
      current: z.object({
        shop: ShopSchema,
        price: PriceDetailSchema,
        regular: PriceDetailSchema,
        url: z.string(),
      }),
      lowest: z.object({
        shop: ShopSchema,
        price: PriceDetailSchema,
        url: z.string().optional(),
      }),
    }),
  ),
});

export type ItadLookupResponse = z.infer<typeof ItadLookupResponseSchema>;
export type ItadPricesResponse = z.infer<typeof ItadPricesResponseSchema>;
export type ItadOverviewResponse = z.infer<typeof ItadOverviewResponseSchema>;
