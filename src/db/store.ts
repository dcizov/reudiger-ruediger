import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type {
  DealMessageReference,
  DealOfTheDayClaim,
  DealPostingRecord,
  DealStore,
} from "../types/deals.js";
import type { SteamGameMetadata } from "../schemas/steamStore.js";
import { generateDealId } from "../util/itadDeals.js";
import type { DealDatabase } from "./client.js";
import {
  dealOfTheDay,
  postedDeals,
  steamMappings,
  steamMetadataCache,
} from "./schema.js";

export class PostgresDealStore implements DealStore {
  constructor(private readonly db: DealDatabase) {}

  async getPostedOfferKeys(gameIds: readonly string[]): Promise<Set<string>> {
    if (gameIds.length === 0) return new Set();

    const rows = await this.db
      .select({ gameId: postedDeals.gameId, shopId: postedDeals.shopId })
      .from(postedDeals)
      .where(
        and(
          inArray(postedDeals.gameId, [...new Set(gameIds)]),
          isNotNull(postedDeals.messageId)
        )
      );

    return new Set(
      rows.map((row) =>
        generateDealId({
          id: row.gameId,
          deal: { shop: { id: row.shopId } },
        })
      )
    );
  }

  async getCooledDownGameIds(
    gameIds: readonly string[],
    now: Date
  ): Promise<Set<string>> {
    if (gameIds.length === 0) return new Set();

    const rows = await this.db
      .select({ gameId: dealOfTheDay.gameId })
      .from(dealOfTheDay)
      .where(
        and(
          inArray(dealOfTheDay.gameId, [...new Set(gameIds)]),
          gt(dealOfTheDay.cooldownUntil, now)
        )
      );

    return new Set(rows.map((row) => row.gameId));
  }

  async getSteamMappings(
    gameIds: readonly string[]
  ): Promise<Map<string, number>> {
    if (gameIds.length === 0) return new Map();

    const rows = await this.db
      .select({ gameId: steamMappings.gameId, appId: steamMappings.appId })
      .from(steamMappings)
      .where(inArray(steamMappings.gameId, [...new Set(gameIds)]));

    return new Map(rows.map((row) => [row.gameId, row.appId]));
  }

  async saveSteamMappings(
    mappings: ReadonlyMap<string, number>
  ): Promise<void> {
    const values = [...mappings.entries()].map(([gameId, appId]) => ({
      gameId,
      appId,
      updatedAt: new Date(),
    }));
    if (values.length === 0) return;

    await this.db
      .insert(steamMappings)
      .values(values)
      .onConflictDoUpdate({
        target: steamMappings.gameId,
        set: {
          appId: sql`excluded.app_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async getSteamMetadata(
    appIds: readonly number[],
    freshAfter: Date
  ): Promise<Map<number, SteamGameMetadata>> {
    if (appIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        appId: steamMetadataCache.appId,
        metadata: steamMetadataCache.metadata,
      })
      .from(steamMetadataCache)
      .where(
        and(
          inArray(steamMetadataCache.appId, [...new Set(appIds)]),
          gt(steamMetadataCache.updatedAt, freshAfter)
        )
      );

    return new Map(rows.map((row) => [row.appId, row.metadata]));
  }

  async saveSteamMetadata(
    metadata: ReadonlyMap<number, SteamGameMetadata>,
    updatedAt: Date
  ): Promise<void> {
    const values = [...metadata.entries()].map(([appId, value]) => ({
      appId,
      metadata: value,
      updatedAt,
    }));
    if (values.length === 0) return;

    await this.db
      .insert(steamMetadataCache)
      .values(values)
      .onConflictDoUpdate({
        target: steamMetadataCache.appId,
        set: {
          metadata: sql`excluded.metadata`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async claimOffer(
    record: DealPostingRecord,
    claimToken: string,
    now: Date,
    leaseMs: number
  ): Promise<boolean> {
    const claimUntil = new Date(now.getTime() + leaseMs);
    const values = {
      ...record,
      claimToken,
      claimUntil,
      messageId: null,
      channelId: null,
      postedAt: null,
    };

    const rows = await this.db
      .insert(postedDeals)
      .values(values)
      .onConflictDoUpdate({
        target: [postedDeals.gameId, postedDeals.shopId],
        set: { claimToken, claimUntil },
        where: and(
          isNull(postedDeals.messageId),
          or(isNull(postedDeals.claimUntil), lte(postedDeals.claimUntil, now))
        ),
      })
      .returning({ gameId: postedDeals.gameId });

    return rows.length > 0;
  }

  async markOfferPosted(
    gameId: string,
    shopId: number,
    claimToken: string,
    message: DealMessageReference,
    postedAt: Date,
    dayClaim?: DealOfTheDayClaim
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const rows = await transaction
        .update(postedDeals)
        .set({
          messageId: message.messageId,
          channelId: message.channelId,
          postedAt,
          claimToken: null,
          claimUntil: null,
        })
        .where(
          and(
            eq(postedDeals.gameId, gameId),
            eq(postedDeals.shopId, shopId),
            eq(postedDeals.claimToken, claimToken),
            isNull(postedDeals.messageId)
          )
        )
        .returning({ gameId: postedDeals.gameId });

      if (rows.length === 0) {
        throw new Error("Could not persist the sent Discord deal message");
      }

      if (dayClaim) {
        const dayRows = await transaction
          .update(dealOfTheDay)
          .set({
            postedAt,
            cooldownUntil: dayClaim.cooldownUntil,
            claimToken: null,
            claimUntil: null,
          })
          .where(
            and(
              eq(dealOfTheDay.gameId, gameId),
              eq(dealOfTheDay.claimToken, dayClaim.claimToken)
            )
          )
          .returning({ gameId: dealOfTheDay.gameId });

        if (dayRows.length === 0) {
          throw new Error("Could not persist the deal-of-the-day cooldown");
        }
      }
    });
  }

  async releaseOffer(
    gameId: string,
    shopId: number,
    claimToken: string
  ): Promise<void> {
    await this.db
      .delete(postedDeals)
      .where(
        and(
          eq(postedDeals.gameId, gameId),
          eq(postedDeals.shopId, shopId),
          eq(postedDeals.claimToken, claimToken),
          isNull(postedDeals.messageId)
        )
      );
  }

  async claimDealOfTheDay(
    gameId: string,
    claimToken: string,
    now: Date,
    leaseMs: number
  ): Promise<boolean> {
    const claimUntil = new Date(now.getTime() + leaseMs);
    const rows = await this.db
      .insert(dealOfTheDay)
      .values({
        gameId,
        claimToken,
        claimUntil,
        postedAt: null,
        cooldownUntil: null,
      })
      .onConflictDoUpdate({
        target: dealOfTheDay.gameId,
        set: { claimToken, claimUntil },
        where: and(
          or(
            isNull(dealOfTheDay.cooldownUntil),
            lte(dealOfTheDay.cooldownUntil, now)
          ),
          or(isNull(dealOfTheDay.claimUntil), lte(dealOfTheDay.claimUntil, now))
        ),
      })
      .returning({ gameId: dealOfTheDay.gameId });

    return rows.length > 0;
  }

  async releaseDealOfTheDay(gameId: string, claimToken: string): Promise<void> {
    await this.db
      .update(dealOfTheDay)
      .set({ claimToken: null, claimUntil: null })
      .where(
        and(
          eq(dealOfTheDay.gameId, gameId),
          eq(dealOfTheDay.claimToken, claimToken)
        )
      );
  }
}
