import { z } from 'zod';

import type { ItadDeal, ItadDealsResponse } from '../schemas/itadDeals.js';
import { ItadDealsResponseSchema } from '../schemas/itadDeals.js';
import { logger } from './logger.js';
import { fetchWithRetry } from './retryFetch.js';

/**
 * Cache for ITAD deals to avoid excessive API calls
 * TTL: 15 minutes (deals change frequently but not every minute)
 */
interface DealsCache {
  data: ItadDeal[];
  timestamp: number;
}

const dealsCache = new Map<string, DealsCache>();
const DEALS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function redactApiKey(url: string): string {
  return url.replace(/key=[^&]+/, 'key=[REDACTED]');
}

function getCacheKey(
  country: string,
  limit: number,
  sort: string,
  shops?: number[],
): string {
  const shopsKey = shops?.sort().join(',') ?? 'all';
  return `${country}:${limit}:${sort}:${shopsKey}`;
}

/**
 * Fetch current deals from ITAD /deals/v2 endpoint
 *
 * @param apiKey - ITAD API key
 * @param country - ISO 3166-1 alpha-2 country code (default: 'DE' for Germany/EUR)
 * @param limit - Number of deals to return (1-200, default: 100)
 * @param sort - Sort order: '-cut' for highest discount, 'price' for lowest price (default: '-cut')
 * @param shops - Optional array of shop IDs to filter (e.g., [61] for Steam)
 * @param mature - Include mature content (default: false)
 * @param useCache - Use cached results if available (default: true)
 * @returns Array of ITAD deals
 */
export async function getItadDeals(
  apiKey: string,
  country = 'DE',
  limit = 100,
  sort = '-cut',
  shops?: number[],
  mature = false,
  useCache = true,
): Promise<ItadDeal[]> {
  // Check cache first
  if (useCache) {
    const cacheKey = getCacheKey(country, limit, sort, shops);
    const cached = dealsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < DEALS_CACHE_TTL) {
      logger.debug('Returning cached ITAD deals', {
        cacheKey,
        dealCount: cached.data.length,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
      });
      return cached.data;
    }
  }

  // Build query parameters
  const params = new URLSearchParams({
    key: apiKey,
    country,
    limit: limit.toString(),
    offset: '0',
    mature: mature.toString(),
  });

  if (sort) {
    params.set('sort', sort);
  }

  if (shops && shops.length > 0) {
    params.set('shops', shops.join(','));
  }

  const url = `https://api.isthereanydeal.com/deals/v2?${params.toString()}`;

  try {
    logger.info('Fetching ITAD deals', {
      country,
      limit,
      sort,
      shops: shops?.length ?? 'all',
    });

    const res = await fetchWithRetry(url);

    if (!res.ok) {
      logger.warn(
        `ITAD deals request failed: ${res.status} ${redactApiKey(url)}`,
        {
          status: res.status,
          country,
          limit,
        },
      );
      return [];
    }

    const rawData: unknown = await res.json();
    const result = ItadDealsResponseSchema.safeParse(rawData);

    if (!result.success) {
      logger.error('Invalid ITAD deals response:', {
        error: z.treeifyError(result.error),
      });
      return [];
    }

    const data: ItadDealsResponse = result.data;

    logger.info(
      `Successfully fetched ${data.list.length} deals from ITAD (hasMore: ${data.hasMore})`,
      {
        dealCount: data.list.length,
        hasMore: data.hasMore,
        nextOffset: data.nextOffset,
      },
    );

    // Cache the results
    if (useCache) {
      const cacheKey = getCacheKey(country, limit, sort, shops);
      dealsCache.set(cacheKey, {
        data: data.list,
        timestamp: Date.now(),
      });
    }

    return data.list;
  } catch (error) {
    logger.error(
      `Failed to fetch ITAD deals: ${error instanceof Error ? error.message : String(error)}`,
      { error },
    );
    return [];
  }
}

/**
 * Extract Steam App ID from ITAD game ID
 * ITAD uses format "app/730" for Steam games where 730 is the Steam App ID
 *
 * @param itadGameId - ITAD game ID (e.g., "app/730")
 * @returns Steam App ID or null if not a Steam game
 */
export function extractSteamAppId(itadGameId: string): number | null {
  const match = /^app\/(\d+)$/.exec(itadGameId);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/**
 * Generate a unique deal ID for duplicate detection
 * Combines ITAD game ID and shop ID to create a unique identifier
 *
 * @param deal - ITAD deal object
 * @returns Unique deal ID string
 */
export function generateDealId(deal: ItadDeal): string {
  return `${deal.id}-${deal.deal.shop.id}`;
}

/**
 * Filter deals by minimum discount percentage
 *
 * @param deals - Array of ITAD deals
 * @param minDiscount - Minimum discount percentage (0-100)
 * @returns Filtered deals
 */
export function filterDealsByDiscount(
  deals: ItadDeal[],
  minDiscount: number,
): ItadDeal[] {
  return deals.filter((deal) => deal.deal.cut >= minDiscount);
}

/**
 * Filter deals by maximum price
 *
 * @param deals - Array of ITAD deals
 * @param maxPrice - Maximum price in the deal's currency
 * @returns Filtered deals
 */
export function filterDealsByPrice(
  deals: ItadDeal[],
  maxPrice: number,
): ItadDeal[] {
  return deals.filter((deal) => deal.deal.price.amount <= maxPrice);
}

/**
 * Filter out mature content deals
 *
 * @param deals - Array of ITAD deals
 * @returns Filtered deals without mature content
 */
export function filterOutMatureContent(deals: ItadDeal[]): ItadDeal[] {
  return deals.filter((deal) => !deal.mature);
}

/**
 * Filter deals by type (game, dlc, package)
 *
 * @param deals - Array of ITAD deals
 * @param types - Array of allowed types
 * @returns Filtered deals
 */
export function filterDealsByType(
  deals: ItadDeal[],
  types: ('game' | 'dlc' | 'package')[],
): ItadDeal[] {
  return deals.filter((deal) => deal.type && types.includes(deal.type));
}

/**
 * Detect non-game items by analyzing title patterns
 * Educational bundles, certification courses, and other non-game products should be filtered out
 *
 * @param title - Game title to analyze
 * @returns true if the item is likely NOT a video game
 */
function isNonGameTitle(title: string): boolean {
  const lowerTitle = title.toLowerCase();

  // Educational/certification keywords that indicate non-game content
  const educationKeywords = [
    'certification',
    'elearning',
    'e-learning',
    'course',
    'tutorial',
    'training',
    'bootcamp',
    'learning path',
    'masterclass',
    'workshop',
    'textbook',
    'ebook',
    'e-book',
    'study guide',
  ];

  // Technology/programming keywords that often appear in educational bundles
  const techKeywords = [
    'python',
    'java',
    'c++',
    'javascript',
    'programming',
    'coding',
    'development',
    'devops',
    'cybersecurity',
    'networking',
    'linux',
    'cloud computing',
    'data science',
    'machine learning',
    'web development',
    'software engineering',
  ];

  // Check for education keywords
  if (educationKeywords.some((keyword) => lowerTitle.includes(keyword))) {
    return true;
  }

  // Check for tech keywords combined with "bundle" (e.g., "Python Bundle", "C++ 4th Edition Bundle")
  if (
    lowerTitle.includes('bundle') &&
    techKeywords.some((keyword) => lowerTitle.includes(keyword))
  ) {
    return true;
  }

  // Check for "edition" combined with tech keywords (e.g., "C++ 4th Edition")
  if (
    lowerTitle.includes('edition') &&
    techKeywords.some((keyword) => lowerTitle.includes(keyword))
  ) {
    return true;
  }

  return false;
}

/**
 * Validate if a deal represents an actual video game
 * Filters out educational bundles, certification courses, and other non-game products
 *
 * @param deal - ITAD deal to validate
 * @returns true if the deal is a valid video game
 */
export function isValidGameDeal(deal: ItadDeal): boolean {
  // Filter 1: Title pattern matching - exclude educational/certification content
  if (isNonGameTitle(deal.title)) {
    // Reduced verbosity: individual filtering logged only in aggregate
    return false;
  }

  // Filter 2: Type validation - only accept 'game' type
  // Educational bundles often have type=null or type='package'
  if (deal.type !== 'game') {
    // Reduced verbosity: individual filtering logged only in aggregate
    return false;
  }

  // Filter 3: Platform validation - real games have valid platforms
  // Educational content often has empty platforms array or generic "Unknown"
  if (!deal.deal.platforms || deal.deal.platforms.length === 0) {
    // Reduced verbosity: individual filtering logged only in aggregate
    return false;
  }

  // Filter 4: DRM validation - real games typically have DRM info
  // Some educational content has generic "DRM-Free" or empty DRM arrays
  // This is a soft check - we allow DRM-Free games but flag suspicious patterns
  const hasSuspiciousDrm =
    deal.deal.drm.length === 0 ||
    (deal.deal.drm.length === 1 &&
      deal.deal.drm[0]?.name === 'DRM-Free' &&
      deal.deal.platforms.length === 0);

  if (hasSuspiciousDrm && isNonGameTitle(deal.title)) {
    // Reduced verbosity: individual filtering logged only in aggregate
    return false;
  }

  return true;
}

/**
 * Filter deals to only include valid video games
 * Excludes educational bundles, certification courses, and other non-game products
 *
 * @param deals - Array of ITAD deals
 * @returns Filtered deals containing only video games
 */
export function filterValidGameDeals(deals: ItadDeal[]): ItadDeal[] {
  const filtered = deals.filter(isValidGameDeal);

  if (filtered.length < deals.length) {
    logger.info(
      `Filtered out ${deals.length - filtered.length} non-game items (${filtered.length}/${deals.length} remaining)`,
      {
        originalCount: deals.length,
        filteredCount: filtered.length,
        removedCount: deals.length - filtered.length,
      },
    );
  }

  return filtered;
}

/**
 * Clear the deals cache (useful for testing or forced refresh)
 */
export function clearDealsCache(): void {
  dealsCache.clear();
  logger.debug('ITAD deals cache cleared');
}
