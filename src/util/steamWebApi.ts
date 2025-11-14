import { z } from 'zod';

import { env } from '../config.js';
import {
  OwnedGamesResponseSchema,
  PlayerAchievementsResponseSchema,
  PlayerSummariesResponseSchema,
  ResolveVanityUrlResponseSchema,
  SteamAppListResponseSchema,
  SteamStoreAppDetailsSchema,
  type OwnedGame,
  type PlayerAchievement,
  type PlayerSummary,
  type SteamApp,
  type SteamStoreAppDetails,
} from '../schemas/steam.js';
import { logger } from './logger.js';
import { fetchWithRetry } from './retryFetch.js';

/**
 * Steam Web API Client
 * Documentation: https://developer.valvesoftware.com/wiki/Steam_Web_API
 *
 * Features:
 * - Token bucket rate limiting (configurable calls per minute)
 * - Multi-tier caching with TTL (app list: 24hr, game details: 1hr, profiles: 15min)
 * - Zod validation for all API responses
 * - Graceful error handling with null returns
 * - Supports official Steam Web API and unofficial Store API
 */

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Token bucket rate limiter implementation
 * Ensures we don't exceed Steam API rate limits (default: 100,000 calls/day = ~69 calls/min)
 */
class SteamRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxCallsPerMinute: number) {
    this.maxTokens = maxCallsPerMinute;
    this.tokens = maxCallsPerMinute;
    this.refillRate = maxCallsPerMinute / 60; // convert to per-second rate
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token for making an API request
   * Waits if no tokens are available
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      // Calculate wait time until we have 1 token
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      logger.debug(`Rate limit reached, waiting ${Math.ceil(waitTime)}ms...`, {
        waitTime: Math.ceil(waitTime),
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }
}

// Global rate limiter instance
const rateLimiter = new SteamRateLimiter(env.STEAM_RATE_LIMIT_PER_MINUTE);

// ============================================================================
// Caching System
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic in-memory cache with TTL (time-to-live)
 */
class SteamCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlMinutes: number) {
    this.ttl = ttlMinutes * 60 * 1000; // convert to milliseconds
  }

  /**
   * Get cached data if not expired
   * @returns Cached data or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with current timestamp
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries (call periodically to prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      ttlMinutes: this.ttl / (60 * 1000),
    };
  }
}

// Cache instances with different TTLs based on data volatility
export const steamAppListCache = new SteamCache<SteamApp[]>(24 * 60); // 24 hours
export const steamGameDetailsCache = new SteamCache<SteamStoreAppDetails>(60); // 1 hour
export const steamUserProfileCache = new SteamCache<PlayerSummary>(15); // 15 minutes
export const steamOwnedGamesCache = new SteamCache<OwnedGame[]>(30); // 30 minutes

/**
 * Cleanup all Steam caches (removes expired entries)
 * Call this periodically (e.g., hourly) to prevent memory leaks
 */
export function cleanupSteamCaches(): void {
  steamAppListCache.cleanup();
  steamGameDetailsCache.cleanup();
  steamUserProfileCache.cleanup();
  steamOwnedGamesCache.cleanup();

  logger.debug('Cleaned up Steam API caches', {
    appListSize: steamAppListCache.getStats().size,
    gameDetailsSize: steamGameDetailsCache.getStats().size,
    profilesSize: steamUserProfileCache.getStats().size,
    ownedGamesSize: steamOwnedGamesCache.getStats().size,
  });
}

// ============================================================================
// Generic API Request Function
// ============================================================================

/**
 * Make a request to the Steam Web API with rate limiting and validation
 *
 * @param endpoint - Steam API endpoint (e.g., '/ISteamUser/GetPlayerSummaries/v2/')
 * @param params - Query parameters (API key is added automatically)
 * @param schema - Zod schema for response validation
 * @returns Validated response data or null on error
 */
async function steamApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  schema: z.ZodType<T>,
): Promise<T | null> {
  if (!env.STEAM_API_KEY) {
    logger.warn('Steam API key not configured, skipping request', {
      endpoint,
    });
    return null;
  }

  // Acquire rate limit token
  await rateLimiter.acquire();

  // Construct URL
  const url = new URL(`https://api.steampowered.com${endpoint}`);
  url.searchParams.append('key', env.STEAM_API_KEY);
  url.searchParams.append('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  try {
    const response = await fetchWithRetry(url.toString());

    if (!response.ok) {
      logger.warn(`Steam API request failed: ${response.status}`, {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const rawData: unknown = await response.json();
    const result = schema.safeParse(rawData);

    if (!result.success) {
      logger.error('Steam API response validation failed', {
        endpoint,
        error: z.treeifyError(result.error),
      });
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error('Steam API request error', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Steam App List
// ============================================================================

/**
 * Get complete list of all Steam apps
 * Cached for 24 hours to minimize API calls
 *
 * @returns Array of Steam apps or empty array on error
 */
export async function getSteamAppList(): Promise<SteamApp[]> {
  const cacheKey = 'applist';
  const cached = steamAppListCache.get(cacheKey);

  if (cached) {
    logger.debug('Using cached Steam app list', { appCount: cached.length });
    return cached;
  }

  logger.info('Fetching Steam app list from API...');

  const response = await steamApiRequest(
    '/ISteamApps/GetAppList/v2/',
    {},
    SteamAppListResponseSchema,
  );

  if (!response) {
    logger.warn('Failed to fetch Steam app list');
    return [];
  }

  const apps = response.applist.apps;
  steamAppListCache.set(cacheKey, apps);

  logger.info(`Fetched and cached ${apps.length} Steam apps`);

  return apps;
}

/**
 * Search Steam apps by name (case-insensitive partial match)
 *
 * @param query - Search query
 * @param limit - Maximum number of results (default: 25)
 * @returns Matching Steam apps
 */
export async function searchSteamApps(
  query: string,
  limit = 25,
): Promise<SteamApp[]> {
  const apps = await getSteamAppList();
  const lowerQuery = query.toLowerCase();

  const results = apps
    .filter((app) => app.name.toLowerCase().includes(lowerQuery))
    .slice(0, limit);

  logger.debug(
    `Steam app search: "${query}" returned ${results.length} results`,
    {
      query,
      resultCount: results.length,
    },
  );

  return results;
}

// ============================================================================
// Steam Store API (Unofficial)
// ============================================================================

/**
 * Get detailed game information from Steam Store API
 * Note: This is an unofficial API but widely used and reliable
 * Cached for 1 hour
 *
 * @param appId - Steam app ID
 * @param country - Country code for pricing (default: 'de' for Germany/EUR)
 * @returns Game details or null if not found/error
 */
export async function getSteamStoreDetails(
  appId: number,
  country = 'de',
): Promise<SteamStoreAppDetails | null> {
  const cacheKey = `store_${appId}_${country}`;
  const cached = steamGameDetailsCache.get(cacheKey);

  if (cached) {
    logger.debug(`Using cached Steam store details for app ${appId}`);
    return cached;
  }

  // Store API doesn't require API key
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${country}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      logger.warn(
        `Steam Store API request failed for app ${appId}: ${response.status}`,
        { appId, status: response.status },
      );
      return null;
    }

    const rawData: unknown = await response.json();

    // Store API returns object with appId as key
    const appData = (rawData as Record<string, unknown>)[String(appId)];
    const result = SteamStoreAppDetailsSchema.safeParse(appData);

    if (!result.success) {
      logger.debug(`Steam Store API validation failed for app ${appId}`, {
        appId,
        error: z.treeifyError(result.error),
      });
      return null;
    }

    if (!result.data.success || !result.data.data) {
      logger.debug(`No store data available for app ${appId}`, { appId });
      return null;
    }

    steamGameDetailsCache.set(cacheKey, result.data);
    logger.debug(`Cached Steam store details for app ${appId}`, { appId });

    return result.data;
  } catch (error) {
    logger.error(`Failed to fetch Steam store details for app ${appId}`, {
      appId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Player Profiles
// ============================================================================

/**
 * Get player profile summary
 * Cached for 15 minutes
 *
 * @param steamId - 64-bit Steam ID
 * @returns Player summary or null if not found/error
 */
export async function getPlayerSummary(
  steamId: string,
): Promise<PlayerSummary | null> {
  const cacheKey = `profile_${steamId}`;
  const cached = steamUserProfileCache.get(cacheKey);

  if (cached) {
    logger.debug(`Using cached profile for Steam ID ${steamId}`);
    return cached;
  }

  const response = await steamApiRequest(
    '/ISteamUser/GetPlayerSummaries/v2/',
    { steamids: steamId },
    PlayerSummariesResponseSchema,
  );

  if (!response || response.response.players.length === 0) {
    logger.warn(`No player found for Steam ID ${steamId}`, { steamId });
    return null;
  }

  const player = response.response.players[0];

  if (!player) {
    logger.warn(`No player data in response for Steam ID ${steamId}`, {
      steamId,
    });
    return null;
  }

  steamUserProfileCache.set(cacheKey, player);

  logger.debug(`Cached profile for ${player.personaname} (${steamId})`, {
    steamId,
    personaname: player.personaname,
  });

  return player;
}

/**
 * Resolve Steam vanity URL to 64-bit Steam ID
 *
 * @param vanityUrl - Vanity URL name (e.g., 'gabelogannewell')
 * @returns 64-bit Steam ID or null if not found/error
 */
export async function resolveSteamVanityUrl(
  vanityUrl: string,
): Promise<string | null> {
  const response = await steamApiRequest(
    '/ISteamUser/ResolveVanityURL/v1/',
    { vanityurl: vanityUrl },
    ResolveVanityUrlResponseSchema,
  );

  if (response?.response.success !== 1) {
    logger.debug(`Failed to resolve vanity URL: ${vanityUrl}`, {
      vanityUrl,
      message: response?.response.message,
    });
    return null;
  }

  logger.debug(
    `Resolved vanity URL "${vanityUrl}" to ${response.response.steamid}`,
    {
      vanityUrl,
      steamId: response.response.steamid,
    },
  );

  return response.response.steamid ?? null;
}

// ============================================================================
// Player Games
// ============================================================================

/**
 * Get list of games owned by a player
 * Cached for 30 minutes
 * Note: Only works if the player's profile is public
 *
 * @param steamId - 64-bit Steam ID
 * @param includeAppInfo - Include app name and logo URLs (default: true)
 * @param includePlayedFreeGames - Include free games (default: false)
 * @returns Array of owned games or null if profile is private/error
 */
export async function getOwnedGames(
  steamId: string,
  includeAppInfo = true,
  includePlayedFreeGames = false,
): Promise<OwnedGame[] | null> {
  const cacheKey = `owned_${steamId}_${includeAppInfo}_${includePlayedFreeGames}`;
  const cached = steamOwnedGamesCache.get(cacheKey);

  if (cached) {
    logger.debug(`Using cached owned games for Steam ID ${steamId}`);
    return cached;
  }

  const response = await steamApiRequest(
    '/IPlayerService/GetOwnedGames/v1/',
    {
      steamid: steamId,
      include_appinfo: includeAppInfo ? 1 : 0,
      include_played_free_games: includePlayedFreeGames ? 1 : 0,
    },
    OwnedGamesResponseSchema,
  );

  if (!response?.response.games) {
    logger.debug(
      `No games found for Steam ID ${steamId} (profile may be private)`,
      {
        steamId,
      },
    );
    return null;
  }

  const games = response.response.games;
  steamOwnedGamesCache.set(cacheKey, games);

  logger.debug(`Cached ${games.length} owned games for Steam ID ${steamId}`, {
    steamId,
    gameCount: games.length,
  });

  return games;
}

// ============================================================================
// Player Achievements
// ============================================================================

/**
 * Get player achievements for a specific game
 * Note: Only works if the player's profile and game stats are public
 *
 * @param steamId - 64-bit Steam ID
 * @param appId - Steam app ID
 * @returns Array of achievements or null if not available/error
 */
export async function getPlayerAchievements(
  steamId: string,
  appId: number,
): Promise<PlayerAchievement[] | null> {
  const response = await steamApiRequest(
    '/ISteamUserStats/GetPlayerAchievements/v1/',
    {
      steamid: steamId,
      appid: appId,
    },
    PlayerAchievementsResponseSchema,
  );

  if (!response?.playerstats.success) {
    logger.debug(
      `Failed to get achievements for Steam ID ${steamId}, app ${appId}`,
      {
        steamId,
        appId,
        error: response?.playerstats.error,
      },
    );
    return null;
  }

  const achievements = response.playerstats.achievements ?? [];

  logger.debug(
    `Retrieved ${achievements.length} achievements for ${response.playerstats.gameName}`,
    {
      steamId,
      appId,
      gameName: response.playerstats.gameName,
      achievementCount: achievements.length,
    },
  );

  return achievements;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  OwnedGame,
  PlayerAchievement,
  PlayerSummary,
  SteamApp,
  SteamStoreAppDetails,
};
