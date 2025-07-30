export async function searchItadGames(
  apiKey: string,
  query: string
): Promise<string[]> {
  const url = `https://api.isthereanydeal.com/games/search/v2?key=${apiKey}&title=${encodeURIComponent(query)}&limit=25`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const matches = data?.results ?? [];

  return matches.map((item: { title: string }) => item.title);
}
