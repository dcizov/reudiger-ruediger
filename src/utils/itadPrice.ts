import type { Client } from 'discord.js';
import { z } from 'zod';

import {
  ItadLookupResponseSchema,
  ItadOverviewResponseSchema,
  ItadPricesResponseSchema,
} from '../schemas/itad';
import { cacheItadGameId, getCachedItadGameId } from './itadGameCache';
import { logger } from './logger';
import { fetchWithRetry } from './retryFetch';

export interface ItadPrice {
  price_new: number;
  price_old: number;
  shop: string;
  url: string;
  currency: string;
}

// Helper to redact API key from URLs in logs
function redactApiKey(url: string): string {
  return url.replace(/key=[^&]+/, 'key=[REDACTED]');
}

export async function getItadGameId(
  apiKey: string,
  title: string,
): Promise<string | null> {
  const cached = getCachedItadGameId(title);
  if (cached) return cached;

  const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&title=${encodeURIComponent(title)}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      logger.warn(
        `ITAD lookup failed for "${title}": ${res.status} ${redactApiKey(url)}`,
        { title, status: res.status },
      );
      return null;
    }

    const rawData: unknown = await res.json();
    const result = ItadLookupResponseSchema.safeParse(rawData);

    if (!result.success) {
      logger.error(`Invalid ITAD lookup response for "${title}":`, {
        title,
        error: z.treeifyError(result.error),
      });
      return null;
    }

    const data = result.data;
    if (data.found && data.game?.id) {
      cacheItadGameId(title, data.game.id);
      return data.game.id;
    }

    return null;
  } catch (error) {
    logger.error(`Failed to lookup game "${title}":`, { title, error });
    return null;
  }
}

export async function getItadEurPrices(
  apiKey: string,
  gameIds: string[],
  country = 'DE',
): Promise<Record<string, ItadPrice>> {
  const url = `https://api.isthereanydeal.com/games/prices/v2?key=${apiKey}&country=${country}`;

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameIds),
    });

    if (!res.ok) {
      logger.warn(
        `Failed to fetch ITAD prices: ${res.status} ${redactApiKey(url)}`,
        { status: res.status, gameIdsCount: gameIds.length },
      );
      return {};
    }

    const rawData: unknown = await res.json();
    const result = ItadPricesResponseSchema.safeParse(rawData);

    if (!result.success) {
      logger.error('Invalid ITAD prices response:', {
        error: z.treeifyError(result.error),
      });
      return {};
    }

    const data = result.data;
    const prices: Record<string, ItadPrice> = {};

    for (const item of data) {
      const deal =
        item.deals.find((d) => d.price.currency === 'EUR') ?? item.deals[0];
      if (!deal) continue;

      prices[item.id] = {
        price_new: deal.price.amount,
        price_old: deal.regular.amount,
        shop: deal.shop.name,
        url: deal.url,
        currency: deal.price.currency,
      };
    }

    return prices;
  } catch (error) {
    logger.error('Failed to fetch ITAD prices:', { error });
    return {};
  }
}

export async function getItadHistoricalLowBatch(
  apiKey: string,
  gameIds: string[],
  country = 'DE',
  _client?: Client,
): Promise<Record<string, { price: number; isLowest: boolean }>> {
  if (gameIds.length === 0) return {};

  const url = `https://api.isthereanydeal.com/games/overview/v2?key=${apiKey}&country=${country}`;

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameIds),
    });

    if (!res.ok) {
      logger.warn(`⚠️ ITAD API error: HTTP ${res.status}`, {
        status: res.status,
      });
      logger.error(
        `ITAD overview batch failed: ${res.status} ${redactApiKey(url)}`,
        { status: res.status, gameIdsCount: gameIds.length },
      );
      return {};
    }

    const rawData: unknown = await res.json();
    const result = ItadOverviewResponseSchema.safeParse(rawData);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      logger.error(`🚨 ITAD API schema validation failed:\n${errors}`, {
        error: z.treeifyError(result.error),
      });
      return {};
    }

    const data = result.data;
    const historical: Record<string, { price: number; isLowest: boolean }> = {};

    for (const gameData of data.prices) {
      const currentPrice = gameData.current.price.amount;
      const historicalLow = gameData.lowest.price.amount;

      historical[gameData.id] = {
        price: historicalLow,
        isLowest: currentPrice <= historicalLow,
      };
    }

    logger.info(
      `Successfully got historical data for ${Object.keys(historical).length}/${gameIds.length} games`,
      {
        historicalCount: Object.keys(historical).length,
        totalGames: gameIds.length,
      },
    );
    return historical;
  } catch (error) {
    logger.error(
      `❌ ITAD historical batch error: ${error instanceof Error ? error.message : String(error)}`,
      { error },
    );
    return {};
  }
}
