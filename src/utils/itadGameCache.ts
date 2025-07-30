const itadGameIdCache = new Map<string, string>();

export function getCachedItadGameId(title: string): string | undefined {
  return itadGameIdCache.get(title.toLowerCase().trim());
}

export function cacheItadGameId(title: string, gameId: string): void {
  itadGameIdCache.set(title.toLowerCase().trim(), gameId);
}
