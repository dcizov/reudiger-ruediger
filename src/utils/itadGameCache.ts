interface CacheEntry {
  gameId: string;
  timestamp: number;
}

const itadGameIdCache = new Map<string, CacheEntry>();

// Cache configuration
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 10000;

export function getCachedItadGameId(title: string): string | undefined {
  const key = title.toLowerCase().trim();
  const entry = itadGameIdCache.get(key);

  if (!entry) return undefined;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    itadGameIdCache.delete(key);
    return undefined;
  }

  return entry.gameId;
}

export function cacheItadGameId(title: string, gameId: string): void {
  const key = title.toLowerCase().trim();

  // Cleanup if cache is too large (remove oldest entry)
  if (itadGameIdCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = itadGameIdCache.keys().next().value;
    if (oldestKey) {
      itadGameIdCache.delete(oldestKey);
    }
  }

  itadGameIdCache.set(key, {
    gameId,
    timestamp: Date.now(),
  });
}
