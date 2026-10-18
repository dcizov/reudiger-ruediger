import type { DealLogger } from "../types/deals.js";
import { dealLogger } from "./logger.js";
import type { ItadApiClient } from "./itadApi.js";

export const DEFAULT_ITAD_STEAM_SHOP_ID = 61;
const LOOKUP_BATCH_SIZE = 200;

export interface SteamAppResolutionResult {
  mappings: Map<string, number>;
  unresolvedGameIds: string[];
  ambiguousGameIds: string[];
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function parseSteamAppId(value: string): number | null {
  const match = /^app\/(\d+)$/.exec(value);
  if (!match?.[1]) return null;

  const appId = Number(match[1]);
  return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
}

/**
 * Resolve only ITAD's explicit mapping from an ITAD game UUID to Steam shop
 * identifiers. Title-search results are deliberately not used as a fallback.
 */
export async function resolveSteamAppIds(
  client: ItadApiClient,
  gameIds: readonly string[],
  cachedMappings: ReadonlyMap<string, number>,
  shopId = DEFAULT_ITAD_STEAM_SHOP_ID,
  enabled = true,
  logger: DealLogger = dealLogger
): Promise<SteamAppResolutionResult> {
  const uniqueIds = [...new Set(gameIds)];
  const mappings = new Map<string, number>();
  const missing: string[] = [];

  for (const gameId of uniqueIds) {
    const cachedAppId = cachedMappings.get(gameId);
    if (cachedAppId && Number.isSafeInteger(cachedAppId) && cachedAppId > 0) {
      mappings.set(gameId, cachedAppId);
    } else {
      missing.push(gameId);
    }
  }

  if (!enabled || missing.length === 0) {
    return {
      mappings,
      unresolvedGameIds: missing,
      ambiguousGameIds: [],
    };
  }

  const unresolvedGameIds: string[] = [];
  const ambiguousGameIds: string[] = [];

  for (const batch of chunks(missing, LOOKUP_BATCH_SIZE)) {
    const shopIdentifiers = await client.lookupShopIds(batch, shopId);

    for (const gameId of batch) {
      const identifiers = shopIdentifiers[gameId] ?? null;
      const appIds = [
        ...new Set(
          (identifiers ?? [])
            .map(parseSteamAppId)
            .filter((appId): appId is number => appId !== null)
        ),
      ];

      if (appIds.length === 1 && appIds[0] !== undefined) {
        mappings.set(gameId, appIds[0]);
      } else if (appIds.length > 1) {
        ambiguousGameIds.push(gameId);
        logger.warn("ITAD returned multiple Steam app IDs for one game", {
          gameId,
          appIdCount: appIds.length,
        });
      } else {
        unresolvedGameIds.push(gameId);
      }
    }
  }

  return { mappings, unresolvedGameIds, ambiguousGameIds };
}
