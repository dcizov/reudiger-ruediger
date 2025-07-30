import { cacheItadGameId, getCachedItadGameId } from "./itadGameCache";

export interface ItadPrice {
  price_new: number;
  price_old: number;
  shop: string;
  url: string;
  currency: string;
}

// Get ITAD game ID from title
export async function getItadGameId(
  apiKey: string,
  title: string
): Promise<string | null> {
  const cached = getCachedItadGameId(title);
  if (cached) return cached;

  const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&title=${encodeURIComponent(title)}`;
  const res = await fetch(url);

  if (!res.ok) return null;

  const data = (await res.json()) as { found: boolean; game?: { id: string } };
  if (data.found && data.game?.id) {
    cacheItadGameId(title, data.game.id);
    return data.game.id;
  }

  return null;
}

// Get prices for a game
export async function getItadEurPrices(
  apiKey: string,
  gameIds: string[],
  country = "DE"
): Promise<Record<string, ItadPrice>> {
  const url = `https://api.isthereanydeal.com/games/prices/v2?key=${apiKey}&country=${country}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameIds),
  });

  if (!res.ok) {
    console.warn("Failed to fetch ITAD prices");
    return {};
  }

  const data = (await res.json()) as Array<{
    id: string;
    deals: Array<{
      shop: { name: string };
      price: { amount: number; amountInt: number; currency: string };
      regular: { amount: number; amountInt: number; currency: string };
      url: string;
    }>;
  }>;

  const result: Record<string, ItadPrice> = {};
  for (const item of data) {
    const deal =
      item.deals.find((d) => d.price.currency === "EUR") || item.deals[0];
    if (!deal) continue;

    result[item.id] = {
      price_new: deal.price.amount,
      price_old: deal.regular.amount,
      shop: deal.shop.name,
      url: deal.url,
      currency: deal.price.currency,
    };
  }

  return result;
}

export async function getItadHistoricalLow(
  apiKey: string,
  gameId: string,
  country = "DE"
): Promise<{ price: number; isLowest: boolean } | null> {
  const url = `https://api.isthereanydeal.com/games/info/v3?key=${apiKey}&country=${country}&ids=${encodeURIComponent(gameId)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const info = data?.[gameId];
  if (!info?.lowest) return null;

  const current = info.price?.price;
  const lowest = info.lowest.price;

  return {
    price: lowest,
    isLowest: current <= lowest,
  };
}
