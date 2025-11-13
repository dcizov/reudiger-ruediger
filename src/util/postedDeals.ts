import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { postedDeals } from '../db/schema.js';
import type { PostedDeal } from '../schemas/deal.js';

// Infer row type from Drizzle schema
type PostedDealRow = typeof postedDeals.$inferSelect;

export async function getPostedDeals(): Promise<PostedDeal[]> {
  const rows = await db.select().from(postedDeals);
  return rows.map((row: PostedDealRow) => ({
    dealId: row.dealId,
    messageId: row.messageId,
    title: row.title,
    store: row.store,
    platform: row.platform,
    salePrice: row.salePrice,
    normalPrice: row.normalPrice,
    savings: row.savings,
    dealRating: row.dealRating,
    imageUrl: row.imageUrl,
    url: row.url,
    postedAt: row.postedAt,
  }));
}

export async function getPostedDealIDs(): Promise<string[]> {
  const rows = await db
    .select({ dealId: postedDeals.dealId })
    .from(postedDeals);
  return rows.map((row: { dealId: string }) => row.dealId);
}

export async function addPostedDeal(deal: PostedDeal): Promise<void> {
  await db.insert(postedDeals).values(deal);
}

export async function removePostedDeal(dealId: string): Promise<void> {
  await db.delete(postedDeals).where(eq(postedDeals.dealId, dealId));
}
