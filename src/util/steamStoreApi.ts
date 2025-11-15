import type { SteamGameMetadata } from '../schemas/steamStore.js';
import {
  SteamStoreResponseSchema,
  type SteamAppDetails,
} from '../schemas/steamStore.js';
import { logger } from './logger.js';

/**
 * Steam Store API Client
 *
 * Fetches game metadata from Steam Store API including:
 * - Metacritic scores (0-100)
 * - User review counts
 * - High-resolution header images
 *
 * Features:
 * - 1-hour in-memory cache to minimize API calls
 * - Batch API support (up to 100 appIds per request)
 * - Graceful error handling (Steam API can be unreliable)
 * - Cache statistics for monitoring
 */

// ============================================================================
// Cache Configuration
// ============================================================================

interface CachedMetadata {
  data: SteamGameMetadata;
  timestamp: number;
}

/**
 * In-memory cache for Steam game metadata
 * Key: Steam App ID (number)
 * Value: Cached metadata with timestamp
 */
const metadataCache = new Map<number, CachedMetadata>();

/**
 * Cache TTL: 1 hour (metadata rarely changes)
 */
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Maximum appIds per batch request (Steam API limit)
 */
const MAX_BATCH_SIZE = 100;

/**
 * Request timeout (Steam API can be slow)
 */
const REQUEST_TIMEOUT = 10000; // 10 seconds

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get cached metadata for a Steam App ID
 */
function getCachedMetadata(appId: number): SteamGameMetadata | null {
  const cached = metadataCache.get(appId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Steam Store API cache hit', { appId });
    return cached.data;
  }

  if (cached) {
    // Expired cache entry
    metadataCache.delete(appId);
    logger.debug('Steam Store API cache expired', { appId });
  }

  return null;
}

/**
 * Cache metadata for a Steam App ID
 */
function setCachedMetadata(appId: number, data: SteamGameMetadata): void {
  metadataCache.set(appId, {
    data,
    timestamp: Date.now(),
  });

  logger.debug('Steam Store API cached', {
    appId,
    hasMetacritic: data.metacriticScore !== null,
    hasReviews: data.totalReviews !== null,
  });
}

/**
 * Get cache statistics for monitoring
 */
export function getSteamStoreCacheStats(): {
  size: number;
  withMetacritic: number;
  withReviews: number;
} {
  const entries = Array.from(metadataCache.values());

  return {
    size: metadataCache.size,
    withMetacritic: entries.filter((e) => e.data.metacriticScore !== null)
      .length,
    withReviews: entries.filter((e) => e.data.totalReviews !== null).length,
  };
}

/**
 * Clear the metadata cache (useful for testing)
 */
export function clearSteamStoreCache(): void {
  metadataCache.clear();
  logger.debug('Steam Store API cache cleared');
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Transform Steam Store API response to simplified metadata
 */
function transformAppDetails(details: SteamAppDetails): SteamGameMetadata {
  if (!details.success || !details.data) {
    return {
      metacriticScore: null,
      totalReviews: null,
      positiveReviews: null,
      headerImage: null,
      developers: [],
      publishers: [],
      genres: [],
      isFree: false,
      comingSoon: false,
    };
  }

  const { data } = details;

  return {
    metacriticScore: data.metacritic?.score ?? null,
    totalReviews: data.recommendations?.total ?? null,
    positiveReviews: null, // Not available from Steam Store API
    headerImage: data.header_image ?? null,
    developers: data.developers ?? [],
    publishers: data.publishers ?? [],
    genres: data.genres?.map((g) => g.description) ?? [],
    isFree: data.is_free ?? false,
    comingSoon: data.release_date?.coming_soon ?? false,
  };
}

/**
 * Fetch Steam game metadata for a single app ID
 *
 * @param appId - Steam App ID
 * @returns Game metadata or null if not found/error
 *
 * @example
 * ```ts
 * const metadata = await getSteamGameMetadata(730); // CS2
 * if (metadata?.metacriticScore) {
 *   console.log(`Metacritic: ${metadata.metacriticScore}/100`);
 * }
 * ```
 */
export async function getSteamGameMetadata(
  appId: number,
): Promise<SteamGameMetadata | null> {
  // Check cache first
  const cached = getCachedMetadata(appId);
  if (cached) {
    return cached;
  }

  try {
    // Fetch from Steam Store API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      {
        headers: {
          'User-Agent': 'RuedigerBot/1.0 (Discord Game Deals Bot)',
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Steam Store API error', {
        appId,
        status: response.status,
      });
      return null;
    }

    const json = await response.json();

    // Validate response with Zod
    const parsed = SteamStoreResponseSchema.safeParse(json);

    if (!parsed.success) {
      logger.error('Steam Store API validation error', {
        appId,
        error: parsed.error.message,
      });
      return null;
    }

    // Extract app details
    const appDetails = parsed.data[appId.toString()];

    if (!appDetails) {
      logger.warn('Steam Store API returned no data', { appId });
      return null;
    }

    // Transform and cache
    const metadata = transformAppDetails(appDetails);
    setCachedMetadata(appId, metadata);

    logger.debug('Steam Store API fetched', {
      appId,
      hasMetacritic: metadata.metacriticScore !== null,
      hasReviews: metadata.totalReviews !== null,
    });

    return metadata;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      logger.warn('Steam Store API timeout', { appId });
    } else {
      logger.error('Steam Store API fetch error', {
        appId,
        error,
      });
    }
    return null;
  }
}

/**
 * Batch fetch Steam game metadata for multiple app IDs
 *
 * More efficient than calling getSteamGameMetadata in a loop as it:
 * - Skips cached entries
 * - Batches API requests (up to 100 appIds per request)
 * - Returns partial results even if some requests fail
 *
 * @param appIds - Array of Steam App IDs
 * @returns Map of App ID → metadata (excludes failed fetches)
 *
 * @example
 * ```ts
 * const appIds = [730, 1245620, 570]; // CS2, Elden Ring, Dota 2
 * const results = await batchGetSteamGameMetadata(appIds);
 * results.forEach((metadata, appId) => {
 *   console.log(`${appId}: ${metadata.metacriticScore ?? 'N/A'}/100`);
 * });
 * ```
 */
export async function batchGetSteamGameMetadata(
  appIds: number[],
): Promise<Map<number, SteamGameMetadata>> {
  const results = new Map<number, SteamGameMetadata>();

  logger.info(`Batch fetching Steam metadata for ${appIds.length} games...`, {
    appIdCount: appIds.length,
  });

  // Separate cached and uncached appIds
  const uncached: number[] = [];

  for (const appId of appIds) {
    const cached = getCachedMetadata(appId);
    if (cached) {
      results.set(appId, cached);
    } else {
      uncached.push(appId);
    }
  }

  if (uncached.length === 0) {
    logger.info('All Steam metadata found in cache', {
      cacheHits: appIds.length,
    });
    return results;
  }

  logger.info(
    `${uncached.length} Steam games not cached, fetching from API...`,
    {
      cacheHits: results.size,
      cacheMisses: uncached.length,
    },
  );

  // Split into batches of MAX_BATCH_SIZE
  const batches: number[][] = [];
  for (let i = 0; i < uncached.length; i += MAX_BATCH_SIZE) {
    batches.push(uncached.slice(i, i + MAX_BATCH_SIZE));
  }

  // Fetch each batch
  for (const batch of batches) {
    try {
      const appIdsParam = batch.join(',');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appIdsParam}`,
        {
          headers: {
            'User-Agent': 'RuedigerBot/1.0 (Discord Game Deals Bot)',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn('Steam Store API batch error', {
          batchSize: batch.length,
          status: response.status,
        });
        continue;
      }

      const json = await response.json();

      // Validate response
      const parsed = SteamStoreResponseSchema.safeParse(json);

      if (!parsed.success) {
        logger.error('Steam Store API batch validation error', {
          batchSize: batch.length,
          error: parsed.error.message,
        });
        continue;
      }

      // Process each app in the batch
      for (const appId of batch) {
        const appDetails = parsed.data[appId.toString()];

        if (appDetails) {
          const metadata = transformAppDetails(appDetails);
          setCachedMetadata(appId, metadata);
          results.set(appId, metadata);
        }
      }

      logger.debug('Steam Store API batch fetched', {
        batchSize: batch.length,
        successCount: batch.filter((id) => results.has(id)).length,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.warn('Steam Store API batch timeout', {
          batchSize: batch.length,
        });
      } else {
        logger.error('Steam Store API batch fetch error', {
          batchSize: batch.length,
          error,
        });
      }
    }
  }

  logger.info(
    `Fetched ${results.size}/${appIds.length} Steam game metadata (${Math.round((results.size / appIds.length) * 100)}% success rate)`,
    {
      total: appIds.length,
      fetched: results.size,
      successRate: Math.round((results.size / appIds.length) * 100),
      cacheHits: appIds.length - uncached.length,
    },
  );

  return results;
}
