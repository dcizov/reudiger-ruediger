import type { ItadGameOverview } from "../schemas/itad.js";
import type { ItadApiClient } from "./itadApi.js";

export const ITAD_OVERVIEW_BATCH_SIZE = 200;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
}

export async function getItadGameOverviews(
  client: ItadApiClient,
  gameIds: readonly string[],
  country: string,
  vouchers: boolean
): Promise<Map<string, ItadGameOverview>> {
  const overviews = new Map<string, ItadGameOverview>();
  const uniqueIds = [...new Set(gameIds)];

  for (const batch of chunk(uniqueIds, ITAD_OVERVIEW_BATCH_SIZE)) {
    const response = await client.getPriceOverview(batch, country, vouchers);
    for (const overview of response.prices) {
      overviews.set(overview.id, overview);
    }
  }

  return overviews;
}
