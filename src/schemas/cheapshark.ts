import { z } from 'zod';

export const CheapSharkDealSchema = z.object({
  title: z.string(),
  salePrice: z.string(),
  normalPrice: z.string(),
  savings: z.string(),
  storeID: z.string(),
  dealID: z.string(),
  steamAppID: z.string().optional(),
  thumb: z.string(),
  dealRating: z.string(),
  lastChange: z.number(),
});

export const CheapSharkDealsResponseSchema = z.array(CheapSharkDealSchema);

export type CheapSharkDeal = z.infer<typeof CheapSharkDealSchema>;
export type CheapSharkDealsResponse = z.infer<
  typeof CheapSharkDealsResponseSchema
>;
