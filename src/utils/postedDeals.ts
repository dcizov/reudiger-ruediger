import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { postedDeals } from "../db/schema";

export interface PostedDeal {
  dealId: string;
  messageId: string;
  title: string;
  store: string;
  platform: string;
  salePrice: string | null;
  normalPrice: string | null;
  savings: string | null;
  dealRating: string | null;
  imageUrl: string | null;
  url: string | null;
  postedAt: Date | null;
}

export async function getPostedDeals(): Promise<PostedDeal[]> {
  const rows = await db.select().from(postedDeals);
  return rows.map((row) => ({
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
  return rows.map((row) => row.dealId);
}

export async function addPostedDeal(deal: PostedDeal): Promise<void> {
  await db.insert(postedDeals).values(deal);
}

export async function removePostedDeal(dealId: string): Promise<void> {
  await db.delete(postedDeals).where(eq(postedDeals.dealId, dealId));
}
