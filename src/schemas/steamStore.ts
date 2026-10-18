import { z } from "zod";

const SteamStoreDataSchema = z
  .object({
    type: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(512).optional(),
    steam_appid: z.number().int().positive().optional(),
    is_free: z.boolean().optional(),
    header_image: z.string().url().optional(),
    developers: z.array(z.string().max(256)).optional(),
    publishers: z.array(z.string().max(256)).optional(),
    genres: z
      .array(z.object({ description: z.string().max(128) }).passthrough())
      .optional(),
    recommendations: z
      .object({ total: z.number().int().nonnegative().optional() })
      .passthrough()
      .nullish(),
    metacritic: z
      .object({
        score: z.number().int().min(0).max(100).optional(),
        url: z.string().url().optional(),
      })
      .passthrough()
      .nullish(),
    release_date: z
      .object({
        coming_soon: z.boolean().optional(),
        date: z.string().max(128).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const SteamAppDetailsEnvelopeSchema = z
  .object({
    success: z.boolean(),
    data: z
      .union([SteamStoreDataSchema, z.null(), z.literal(false)])
      .optional(),
  })
  .passthrough();

export const SteamStoreResponseSchema = z.record(
  z.string().regex(/^\d+$/),
  SteamAppDetailsEnvelopeSchema
);

export type SteamStoreData = z.infer<typeof SteamStoreDataSchema>;

export interface SteamGameMetadata {
  appId: number;
  name: string | null;
  type: string | null;
  isFree: boolean | null;
  comingSoon: boolean;
  totalReviews: number | null;
  metacriticScore: number | null;
  headerImage: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  releaseDate: string | null;
}
