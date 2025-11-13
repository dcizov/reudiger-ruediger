import { z } from 'zod';

import {
  CheapSharkDealsResponseSchema,
  type CheapSharkDeal,
} from '../schemas/cheapshark.js';
import { logger } from './logger.js';
import { fetchWithRetry } from './retryFetch.js';

export type { CheapSharkDeal };

export async function getDeals(limit = 5): Promise<CheapSharkDeal[]> {
  const url = `https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=${limit}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      logger.error(
        `Failed to fetch CheapShark deals: ${response.status} ${response.statusText}`,
        { status: response.status, statusText: response.statusText },
      );
      return [];
    }

    const rawData: unknown = await response.json();
    const result = CheapSharkDealsResponseSchema.safeParse(rawData);

    if (!result.success) {
      logger.error('Invalid CheapShark API response:', {
        error: z.treeifyError(result.error),
      });
      return [];
    }

    return result.data;
  } catch (error) {
    logger.error('Failed to fetch CheapShark deals:', { error });
    return [];
  }
}
