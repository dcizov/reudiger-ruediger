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
  const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&title=${encodeURIComponent(title)}`;
  const res = await fetch(url);

  if (!res.ok) return null;

  const data = (await res.json()) as { found: boolean; game?: { id: string } };
  return data.found && data.game ? data.game.id : null;
}

// Get prices for a game
export async function getItadEurPrice(
  apiKey: string,
  gameId: string,
  country = "DE"
): Promise<ItadPrice | null> {
  const url = `https://api.isthereanydeal.com/games/prices/v2?key=${apiKey}&country=${country}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([gameId]),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    id: string;
    deals: Array<{
      shop: { name: string };
      price: { amount: number; amountInt: number; currency: string };
      regular: { amount: number; amountInt: number; currency: string };
      url: string;
    }>;
  }>;

  const gameData = data[0];
  if (!gameData || !gameData.deals || gameData.deals.length === 0) return null;

  // Find EUR deal or use first available
  const deal =
    gameData.deals.find((d) => d.price.currency === "EUR") || gameData.deals[0];

  return {
    price_new: deal.price.amount,
    price_old: deal.regular.amount,
    shop: deal.shop.name,
    url: deal.url,
    currency: deal.price.currency,
  };
}
