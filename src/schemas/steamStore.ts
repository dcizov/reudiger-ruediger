import { z } from 'zod';

/**
 * Zod schemas for Steam Store API responses
 * API Endpoint: https://store.steampowered.com/api/appdetails
 *
 * API Documentation:
 * - Unofficial endpoint, no rate limit guarantees
 * - Returns game metadata including Metacritic scores, reviews, images
 * - Response format: { "[appId]": { success: boolean, data: {...} } }
 * - Can batch requests with comma-separated appids parameter
 *
 * Response quirks:
 * - Returns {success: false} for invalid/removed games
 * - Metacritic and recommendations fields are optional
 * - Some games have recommendations but no Metacritic score
 */

/**
 * Metacritic review data
 */
export const SteamMetacriticSchema = z.object({
  score: z.number().int().min(0).max(100), // Metacritic score (0-100)
  url: z.string().url(), // Link to Metacritic review page
});

/**
 * Steam user recommendations (reviews)
 */
export const SteamRecommendationsSchema = z.object({
  total: z.number().int().min(0), // Total number of user reviews
});

/**
 * Steam genre data
 */
export const SteamGenreSchema = z.object({
  id: z.string(), // Genre ID
  description: z.string(), // Genre name (e.g., "Action", "RPG")
});

/**
 * Steam category data (features like single-player, multiplayer, etc.)
 */
export const SteamCategorySchema = z.object({
  id: z.number(), // Category ID
  description: z.string(), // Category name
});

/**
 * Full Steam app details data
 * Only includes fields we actually use
 */
export const SteamAppDataSchema = z.object({
  name: z.string(), // Game title
  type: z.string(), // 'game', 'dlc', 'demo', etc.
  header_image: z.string().url().optional(), // High-res header image (460x215)
  metacritic: SteamMetacriticSchema.optional(), // Metacritic score (if available)
  recommendations: SteamRecommendationsSchema.optional(), // User review count
  developers: z.array(z.string()).optional(), // Developer names
  publishers: z.array(z.string()).optional(), // Publisher names
  genres: z.array(SteamGenreSchema).optional(), // Game genres
  categories: z.array(SteamCategorySchema).optional(), // Game features/categories
  is_free: z.boolean().optional(), // Free-to-play flag
  release_date: z
    .object({
      coming_soon: z.boolean(),
      date: z.string(),
    })
    .optional(), // Release date info
});

/**
 * Steam app details response wrapper
 */
export const SteamAppDetailsSchema = z.object({
  success: z.boolean(),
  data: SteamAppDataSchema.optional(), // Only present if success = true
});

/**
 * Complete Steam Store API response
 * Key is the appId as a string
 */
export const SteamStoreResponseSchema = z.record(
  z.string(), // appId
  SteamAppDetailsSchema,
);

// Type exports
export type SteamMetacritic = z.infer<typeof SteamMetacriticSchema>;
export type SteamRecommendations = z.infer<typeof SteamRecommendationsSchema>;
export type SteamAppData = z.infer<typeof SteamAppDataSchema>;
export type SteamAppDetails = z.infer<typeof SteamAppDetailsSchema>;
export type SteamStoreResponse = z.infer<typeof SteamStoreResponseSchema>;

/**
 * Simplified Steam metadata for deal enrichment
 */
export interface SteamGameMetadata {
  metacriticScore: number | null; // 0-100, null if not available
  totalReviews: number | null; // Total review count, null if not available
  positiveReviews: number | null; // Not provided by Steam Store API directly
  headerImage: string | null; // High-res header image URL
  developers: string[]; // Developer names
  publishers: string[]; // Publisher names
  genres: string[]; // Genre names (e.g., ["Action", "RPG"])
  isFree: boolean; // Free-to-play flag
  comingSoon: boolean; // Coming soon flag
}
