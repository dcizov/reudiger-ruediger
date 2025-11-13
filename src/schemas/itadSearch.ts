import { z } from 'zod';

export const ItadSearchResponseSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string().nullish(),
    title: z.string(),
    type: z.string().nullish(),
    mature: z.boolean().nullish(),
    assets: z
      .object({
        banner: z.string().nullish(),
        boxart: z.string().nullish(),
      })
      .nullish(),
  }),
);

export type ItadSearchResponse = z.infer<typeof ItadSearchResponseSchema>;
