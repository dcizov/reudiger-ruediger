export interface CheapSharkDeal {
  title: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  storeID: string;
  dealID: string;
  steamAppID?: string;
  thumb: string;
  dealRating: string;
  lastChange: number;
}

export async function getDeals(limit = 5): Promise<CheapSharkDeal[]> {
  const url = `https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch deals: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as CheapSharkDeal[];
  return data;
}
