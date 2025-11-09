import { z } from 'zod';

// ITAD Search API v1 response schema
// Docs: https://docs.isthereanydeal.com/
// Note: API can return null for optional fields, not just undefined
export const ItadSearchResponseSchema = z.array(
  z.object({
    id: z.string(), // UUID identifier
    slug: z.string().nullish(), // URL-friendly name (can be null or undefined)
    title: z.string(), // Display title
    type: z.string().nullish(), // e.g., "game", "dlc" (can be null or undefined)
    mature: z.boolean().nullish(), // Adult content flag (can be null or undefined)
    assets: z
      .object({
        banner: z.string().nullish(),
        boxart: z.string().nullish(),
      })
      .nullish(),
  }),
);

export type ItadSearchResponse = z.infer<typeof ItadSearchResponseSchema>;
