import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { itadSteamMappings } from '../db/schema.js';
import { extractSteamAppId } from './itadDeals.js';
import { logger } from './logger.js';
import { searchSteamApps } from './steamWebApi.js';

/**
 * Steam App ID Resolver
 *
 * Resolves ITAD game IDs to Steam App IDs using multiple strategies:
 * 1. Direct extraction from ITAD game ID (format: "app/730" → 730)
 * 2. Fallback to Steam app list search by game title
 * 3. In-memory caching to minimize lookups
 *
 * This module bridges the gap between ITAD's game identification
 * and Steam's App ID system, enabling high-res images and metadata.
 */

// ============================================================================
// Database Cache Functions
// ============================================================================

/**
 * Check database for existing ITAD → Steam App ID mapping
 */
async function getDbMapping(itadGameId: string): Promise<number | null> {
  try {
    const result = await db
      .select({ steamAppId: itadSteamMappings.steamAppId })
      .from(itadSteamMappings)
      .where(eq(itadSteamMappings.itadGameId, itadGameId))
      .limit(1);

    if (result.length > 0 && result[0]) {
      logger.debug('Steam App ID database hit', {
        itadGameId,
        steamAppId: result[0].steamAppId,
      });
      return result[0].steamAppId;
    }

    return null;
  } catch (error) {
    logger.error('Failed to query database for Steam App ID mapping', {
      itadGameId,
      error,
    });
    return null;
  }
}

/**
 * Save ITAD → Steam App ID mapping to database
 */
async function saveDbMapping(
  itadGameId: string,
  steamAppId: number,
  gameTitle: string,
  method: 'extraction' | 'search',
): Promise<void> {
  try {
    await db
      .insert(itadSteamMappings)
      .values({
        itadGameId,
        steamAppId,
        gameTitle,
        resolvedBy: method,
      })
      .onConflictDoNothing(); // Ignore if already exists

    logger.debug('Steam App ID mapping saved to database', {
      itadGameId,
      steamAppId,
      gameTitle,
      method,
    });
  } catch (error) {
    logger.error('Failed to save Steam App ID mapping to database', {
      itadGameId,
      steamAppId,
      error,
    });
  }
}

// ============================================================================
// In-Memory Cache
// ============================================================================

interface SteamAppIdMapping {
  itadGameId: string;
  steamAppId: number;
  gameTitle: string;
  resolvedAt: number;
  method: 'extraction' | 'search';
}

/**
 * In-memory cache for ITAD → Steam App ID mappings
 * Key: ITAD game ID (e.g., "app/730")
 * Value: Steam App ID (e.g., 730)
 *
 * Cache never expires in-process as game IDs are immutable
 */
const appIdCache = new Map<string, SteamAppIdMapping>();

/**
 * Get cached Steam App ID for an ITAD game ID
 */
function getCachedAppId(itadGameId: string): number | null {
  const cached = appIdCache.get(itadGameId);
  if (cached) {
    logger.debug('Steam App ID cache hit', {
      itadGameId,
      steamAppId: cached.steamAppId,
      method: cached.method,
    });
    return cached.steamAppId;
  }
  return null;
}

/**
 * Cache a successful ITAD → Steam App ID mapping (both in-memory and database)
 */
async function cacheAppId(
  itadGameId: string,
  steamAppId: number,
  gameTitle: string,
  method: 'extraction' | 'search',
): Promise<void> {
  // In-memory cache (instant access)
  appIdCache.set(itadGameId, {
    itadGameId,
    steamAppId,
    gameTitle,
    resolvedAt: Date.now(),
    method,
  });

  // Database cache (persistent across restarts)
  await saveDbMapping(itadGameId, steamAppId, gameTitle, method);

  logger.debug('Steam App ID cached (memory + database)', {
    itadGameId,
    steamAppId,
    gameTitle,
    method,
    cacheSize: appIdCache.size,
  });
}

// ============================================================================
// Resolution Strategies
// ============================================================================

/**
 * Strategy 1: Extract Steam App ID directly from ITAD game ID
 * ITAD uses format "app/730" for Steam games where 730 is the Steam App ID
 *
 * @param itadGameId - ITAD game ID (e.g., "app/730")
 * @returns Steam App ID or null if not extractable
 */
function resolveByExtraction(itadGameId: string): number | null {
  const steamAppId = extractSteamAppId(itadGameId);

  if (steamAppId) {
    logger.debug('Steam App ID extracted from ITAD game ID', {
      itadGameId,
      steamAppId,
    });
  }

  return steamAppId;
}

/**
 * Strategy 2: Search Steam app list by game title
 * Fallback when extraction fails (non-Steam games, bundles, etc.)
 *
 * @param gameTitle - Game title to search for
 * @param itadGameId - ITAD game ID (for logging)
 * @returns Steam App ID or null if not found
 */
async function resolveBySearch(
  gameTitle: string,
  itadGameId: string,
): Promise<number | null> {
  try {
    const results = await searchSteamApps(gameTitle, 1);

    if (results.length > 0 && results[0]) {
      const topMatch = results[0];
      logger.debug('Steam App ID resolved by search', {
        itadGameId,
        gameTitle,
        steamAppId: topMatch.appid,
        matchedName: topMatch.name,
      });
      return topMatch.appid;
    }

    logger.debug('No Steam App ID found by search', {
      itadGameId,
      gameTitle,
    });
    return null;
  } catch (error) {
    logger.error('Steam app search failed', {
      itadGameId,
      gameTitle,
      error,
    });
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve ITAD game ID to Steam App ID
 *
 * Uses multi-tier caching and multi-strategy resolution:
 * 1. Check in-memory cache (fastest)
 * 2. Check database cache (persistent)
 * 3. Try extracting from ITAD game ID
 * 4. Fallback to Steam app list search
 *
 * @param itadGameId - ITAD game ID (e.g., "app/730")
 * @param gameTitle - Game title (used for search fallback)
 * @returns Steam App ID or null if not found/not a Steam game
 *
 * @example
 * ```ts
 * // Direct extraction (instant)
 * const csgoAppId = await resolveSteamAppId('app/730', 'Counter-Strike 2');
 * // Returns: 730
 *
 * // Search fallback (requires API call)
 * const eldenRingAppId = await resolveSteamAppId('game/123', 'Elden Ring');
 * // Returns: 1245620
 * ```
 */
export async function resolveSteamAppId(
  itadGameId: string,
  gameTitle: string,
): Promise<number | null> {
  // Step 1: Check in-memory cache (fastest)
  const cachedInMemory = getCachedAppId(itadGameId);
  if (cachedInMemory !== null) {
    return cachedInMemory;
  }

  // Step 2: Check database cache (persistent across restarts)
  const cachedInDb = await getDbMapping(itadGameId);
  if (cachedInDb !== null) {
    // Warm up in-memory cache from database
    appIdCache.set(itadGameId, {
      itadGameId,
      steamAppId: cachedInDb,
      gameTitle,
      resolvedAt: Date.now(),
      method: 'extraction', // We don't know the actual method from DB
    });
    return cachedInDb;
  }

  // Step 3: Try extraction (instant, no API call)
  const extractedAppId = resolveByExtraction(itadGameId);
  if (extractedAppId !== null) {
    await cacheAppId(itadGameId, extractedAppId, gameTitle, 'extraction');
    return extractedAppId;
  }

  // Step 4: Fallback to search (requires API call, uses Steam app list cache)
  const searchedAppId = await resolveBySearch(gameTitle, itadGameId);
  if (searchedAppId !== null) {
    await cacheAppId(itadGameId, searchedAppId, gameTitle, 'search');
    return searchedAppId;
  }

  // Not found
  logger.debug('Steam App ID resolution failed', {
    itadGameId,
    gameTitle,
  });
  return null;
}

/**
 * Batch resolve multiple ITAD game IDs to Steam App IDs
 *
 * More efficient than calling resolveSteamAppId in a loop as it:
 * - Batches cache lookups
 * - Deduplicates requests
 * - Returns partial results even if some resolutions fail
 *
 * @param games - Array of objects with itadGameId and gameTitle
 * @returns Map of ITAD game ID → Steam App ID (excludes failed resolutions)
 *
 * @example
 * ```ts
 * const games = [
 *   { itadGameId: 'app/730', gameTitle: 'Counter-Strike 2' },
 *   { itadGameId: 'app/1245620', gameTitle: 'Elden Ring' },
 * ];
 *
 * const mapping = await batchResolveSteamAppIds(games);
 * // Returns: Map { 'app/730' => 730, 'app/1245620' => 1245620 }
 * ```
 */
export async function batchResolveSteamAppIds(
  games: { itadGameId: string; gameTitle: string }[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  logger.info(
    `Batch resolving ${games.length} ITAD game IDs to Steam App IDs...`,
    {
      gameCount: games.length,
    },
  );

  // Process in parallel (extraction is instant, search uses cached Steam app list)
  await Promise.all(
    games.map(async ({ itadGameId, gameTitle }) => {
      const steamAppId = await resolveSteamAppId(itadGameId, gameTitle);
      if (steamAppId !== null) {
        results.set(itadGameId, steamAppId);
      }
    }),
  );

  logger.info(
    `Resolved ${results.size}/${games.length} Steam App IDs (${Math.round((results.size / games.length) * 100)}% success rate)`,
    {
      resolved: results.size,
      total: games.length,
      successRate: Math.round((results.size / games.length) * 100),
    },
  );

  return results;
}

/**
 * Get cache statistics for monitoring
 */
export function getAppIdCacheStats(): {
  size: number;
  extractionCount: number;
  searchCount: number;
} {
  const mappings = Array.from(appIdCache.values());

  return {
    size: appIdCache.size,
    extractionCount: mappings.filter((m) => m.method === 'extraction').length,
    searchCount: mappings.filter((m) => m.method === 'search').length,
  };
}

/**
 * Clear the App ID cache (useful for testing)
 */
export function clearAppIdCache(): void {
  appIdCache.clear();
  logger.debug('Steam App ID cache cleared');
}
