import { z } from 'zod';

import { ItadSearchResponseSchema } from '../schemas/itadSearch';
import { logger } from './logger';
import { fetchWithRetry } from './retryFetch';

function redactApiKey(url: string): string {
  return url.replace(/key=[^&]+/, 'key=[REDACTED]');
}

export async function searchItadGames(
  apiKey: string,
  query: string,
): Promise<string[]> {
  const url = `https://api.isthereanydeal.com/games/search/v1?key=${apiKey}&title=${encodeURIComponent(query)}&results=25`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      logger.warn(`ITAD search failed: ${res.status} ${redactApiKey(url)}`, {
        status: res.status,
        query,
      });
      return [];
    }

    const rawData: unknown = await res.json();
    const result = ItadSearchResponseSchema.safeParse(rawData);

    if (!result.success) {
      logger.error('Invalid ITAD search response:', {
        error: z.treeifyError(result.error),
      });
      return [];
    }

    return result.data.map((item) => item.title);
  } catch (error) {
    logger.error('Failed to search ITAD games:', { error });
    return [];
  }
}
