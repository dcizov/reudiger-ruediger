import { promises as fs } from "fs";
import path from "path";

export interface PostedDeal {
  dealID: string;
  messageID: string;
  timestamp: number;
}

const postedDealsPath = path.resolve(__dirname, "../data/postedDeals.json");

export async function getPostedDeals(): Promise<PostedDeal[]> {
  try {
    const data = await fs.readFile(postedDealsPath, "utf-8");
    return JSON.parse(data) as PostedDeal[];
  } catch {
    return [];
  }
}

export async function getPostedDealIDs(): Promise<string[]> {
  const deals = await getPostedDeals();
  return deals.map((d) => d.dealID);
}

export async function addPostedDeal(
  dealID: string,
  messageID: string
): Promise<void> {
  const deals = await getPostedDeals();
  deals.push({ dealID, messageID, timestamp: Date.now() });
  await fs.writeFile(postedDealsPath, JSON.stringify(deals, null, 2));
}

export async function removePostedDeal(dealID: string): Promise<void> {
  const deals = await getPostedDeals();
  const filtered = deals.filter((d) => d.dealID !== dealID);
  await fs.writeFile(postedDealsPath, JSON.stringify(filtered, null, 2));
}
