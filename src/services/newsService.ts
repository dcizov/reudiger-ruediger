import { extract } from '@extractus/feed-extractor';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { and, eq, lt } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '../config.js';
import { db } from '../db/index.js';
import { newsSettings, postedNews } from '../db/schema.js';
import {
  FeedEntrySchema,
  FeedResponseSchema,
  SteamCommunityDataSchema,
  SteamNewsResponseSchema,
  SteamPartnerEventDataSchema,
  SteamPartnerEventSchema,
  type RSSFeedItem,
  type SteamNewsItem,
} from '../schemas/news.js';
import { getBotConfig } from '../util/botConfig.js';
import { logger } from '../util/logger.js';
import {
  sanitizeDiscordDescription,
  sanitizeDiscordText,
} from '../util/sanitizeText.js';

// Infer types from Drizzle schema
type NewsSetting = typeof newsSettings.$inferSelect;

interface RSSCacheEntry {
  data: RSSFeedItem[];
  timestamp: number;
}

const RSS_CACHE = new Map<string, RSSCacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;

// Steam News API response cache
interface SteamNewsCacheEntry {
  data: SteamNewsItem[];
  timestamp: number;
}

const STEAM_NEWS_CACHE = new Map<number, SteamNewsCacheEntry>();

// Steam article image URL cache (longer TTL since images rarely change)
interface ImageCacheEntry {
  imageUrl: string | null;
  timestamp: number;
}

const STEAM_IMAGE_CACHE = new Map<string, ImageCacheEntry>();
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache performance metrics
let steamNewsCacheHits = 0;
let steamNewsCacheMisses = 0;
let steamImageCacheHits = 0;
let steamImageCacheMisses = 0;

/**
 * Clean up expired cache entries for RSS feeds, Steam news, and images
 * Should be called periodically (e.g., every 30 minutes) to prevent memory leaks
 */
export function cleanupExpiredNewsCache(): void {
  const now = Date.now();
  let rssCleanedCount = 0;
  let steamNewsCleanedCount = 0;
  let imageCleanedCount = 0;

  // Clean RSS cache
  for (const [key, entry] of RSS_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      RSS_CACHE.delete(key);
      rssCleanedCount++;
    }
  }

  // Clean Steam news cache
  for (const [key, entry] of STEAM_NEWS_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      STEAM_NEWS_CACHE.delete(key);
      steamNewsCleanedCount++;
    }
  }

  // Clean image cache
  for (const [key, entry] of STEAM_IMAGE_CACHE.entries()) {
    if (now - entry.timestamp > IMAGE_CACHE_TTL) {
      STEAM_IMAGE_CACHE.delete(key);
      imageCleanedCount++;
    }
  }

  const totalCleaned =
    rssCleanedCount + steamNewsCleanedCount + imageCleanedCount;

  // Calculate cache performance metrics
  const steamNewsTotalRequests = steamNewsCacheHits + steamNewsCacheMisses;
  const steamImageTotalRequests = steamImageCacheHits + steamImageCacheMisses;
  const steamNewsHitRate =
    steamNewsTotalRequests > 0
      ? ((steamNewsCacheHits / steamNewsTotalRequests) * 100).toFixed(1)
      : '0.0';
  const steamImageHitRate =
    steamImageTotalRequests > 0
      ? ((steamImageCacheHits / steamImageTotalRequests) * 100).toFixed(1)
      : '0.0';

  if (
    totalCleaned > 0 ||
    steamNewsTotalRequests > 0 ||
    steamImageTotalRequests > 0
  ) {
    logger.debug('News cache status', {
      cleaned: {
        rss: rssCleanedCount,
        steamNews: steamNewsCleanedCount,
        images: imageCleanedCount,
        total: totalCleaned,
      },
      remaining: {
        rss: RSS_CACHE.size,
        steamNews: STEAM_NEWS_CACHE.size,
        images: STEAM_IMAGE_CACHE.size,
      },
      performance: {
        steamNews: {
          hits: steamNewsCacheHits,
          misses: steamNewsCacheMisses,
          hitRate: `${steamNewsHitRate}%`,
        },
        steamImages: {
          hits: steamImageCacheHits,
          misses: steamImageCacheMisses,
          hitRate: `${steamImageHitRate}%`,
        },
      },
    });

    // Reset metrics after logging
    steamNewsCacheHits = 0;
    steamNewsCacheMisses = 0;
    steamImageCacheHits = 0;
    steamImageCacheMisses = 0;
  }
}

const WOWHEAD_ICON = 'https://wow.zamimg.com/images/logos/favicon.png';

export const AVAILABLE_NEWS_SOURCES = {
  cs2: {
    type: 'steam' as const,
    appId: 730,
    name: 'Counter-Strike 2',
    category: 'Games',
    color: 0xffa500,
    icon: '🎮',
    description: 'Official CS2 updates from Steam',
  },
  valheim: {
    type: 'steam' as const,
    appId: 892970,
    name: 'Valheim',
    category: 'Games',
    color: 0x5c8a3d,
    icon: '⚔️',
    description: 'Official Valheim updates from Steam',
  },
  wowRetail: {
    type: 'rss' as const,
    url: 'https://www.wowhead.com/news/rss/retail',
    name: 'WoW Retail',
    category: 'World of Warcraft',
    color: 0x00aeff,
    icon: '🏰',
    description: 'WoW Retail news from Wowhead',
  },
  wowInDev: {
    type: 'rss' as const,
    url: 'https://www.wowhead.com/news/rss/in-dev',
    name: 'WoW In Development',
    category: 'World of Warcraft',
    color: 0xff8c00,
    icon: '🔨',
    description: 'WoW development and PTR news from Wowhead',
  },
} as const;

export type NewsSourceKey = keyof typeof AVAILABLE_NEWS_SOURCES;

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    return response.ok && contentType?.startsWith('image/') === true;
  } catch (error) {
    logger.debug('Image validation failed', { url, error });
    return false;
  }
}

function extractImageFromDescription(description: string): string | undefined {
  if (!description) return undefined;

  const allMatches: string[] = [];

  const imgRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  const dataSrcRegex = /<img[^>]+data-src=["']([^"'>]+)["'][^>]*>/gi;
  while ((match = dataSrcRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  const ogImageRegex =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"'>]+)["'][^>]*>/gi;
  while ((match = ogImageRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  if (allMatches.length === 0) return undefined;

  for (const url of allMatches) {
    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.includes('icon') ||
      lowerUrl.includes('logo') ||
      lowerUrl.includes('avatar') ||
      lowerUrl.includes('favicon') ||
      lowerUrl.includes('16x16') ||
      lowerUrl.includes('32x32') ||
      lowerUrl.includes('64x64') ||
      lowerUrl.includes('/static/')
    ) {
      continue;
    }

    if (lowerUrl.includes('zamimg.com') && lowerUrl.includes('/uploads/')) {
      return url;
    }
  }

  for (const url of allMatches) {
    const lowerUrl = url.toLowerCase();
    if (
      !lowerUrl.includes('icon') &&
      !lowerUrl.includes('logo') &&
      !lowerUrl.includes('favicon')
    ) {
      return url;
    }
  }

  return undefined;
}

/**
 * Extract article-specific image from Steam Community article page
 * Steam embeds article data in JSON within data-partnereventstore attribute
 *
 * @param articleUrl - Full Steam Community article URL
 * @param gid - Article GID from Steam API (used to match correct event in JSON)
 * @returns Promise resolving to image URL or null
 */
async function fetchSteamArticleData(
  articleUrl: string,
  gid: string,
): Promise<string | null> {
  // Check cache first
  const cached = STEAM_IMAGE_CACHE.get(gid);
  if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
    steamImageCacheHits++;
    logger.debug('Using cached Steam article image', { gid });
    return cached.imageUrl;
  }
  steamImageCacheMisses++;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      env.STEAM_IMAGE_FETCH_TIMEOUT,
    );

    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      STEAM_IMAGE_CACHE.set(gid, { imageUrl: null, timestamp: Date.now() });
      return null;
    }

    const html = await response.text();

    let imageUrl: string | null = null;

    // Extract JSON data from data-partnereventstore attribute
    const partnerDataMatch = /<div[^>]*data-partnereventstore="([^"]+)"/.exec(
      html,
    );

    if (partnerDataMatch?.[1]) {
      try {
        // Unescape HTML entities in JSON
        const jsonStr = partnerDataMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#039;/g, "'")
          .replace(/&apos;/g, "'");

        const eventsRaw: unknown = JSON.parse(jsonStr);

        // Validate events array with Zod
        if (Array.isArray(eventsRaw)) {
          const eventsResult = z
            .array(SteamPartnerEventSchema)
            .safeParse(eventsRaw);

          if (eventsResult.success) {
            const events = eventsResult.data;
            const event = events.find((e) => e.gid === gid);

            if (event?.jsondata) {
              // Parse nested jsondata if it's a string
              const eventDataRaw: unknown =
                typeof event.jsondata === 'string'
                  ? JSON.parse(event.jsondata)
                  : event.jsondata;

              // Validate event data with Zod
              const eventDataResult =
                SteamPartnerEventDataSchema.safeParse(eventDataRaw);

              if (eventDataResult.success) {
                const eventData = eventDataResult.data;
                const imageHash = eventData.localized_title_image?.[0];

                if (imageHash) {
                  // Extract clan account ID from data-community attribute
                  const communityDataMatch = /data-community="([^"]+)"/.exec(
                    html,
                  );

                  if (communityDataMatch?.[1]) {
                    try {
                      const communityStr = communityDataMatch[1]
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&');

                      const communityDataRaw: unknown =
                        JSON.parse(communityStr);

                      // Validate community data with Zod
                      const communityDataResult =
                        SteamCommunityDataSchema.safeParse(communityDataRaw);

                      if (communityDataResult.success) {
                        const clanAccountID =
                          communityDataResult.data.CLANACCOUNTID;
                        imageUrl = `https://clan.fastly.steamstatic.com/images/${clanAccountID}/${imageHash}`;
                        logger.debug(
                          'Extracted Steam article image from JSON',
                          {
                            gid,
                            clanAccountID,
                            imageHash,
                            imageUrl,
                          },
                        );
                      }
                    } catch (communityParseError) {
                      logger.debug('Failed to parse data-community JSON', {
                        gid,
                        error: communityParseError,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch (jsonParseError) {
        logger.debug('Failed to parse data-partnereventstore JSON', {
          gid,
          url: articleUrl,
          error: jsonParseError,
        });
      }
    }

    // Fallback to og:image if JSON parsing failed
    if (!imageUrl) {
      const ogImageMatch = /<meta property="og:image" content="([^"]+)"/.exec(
        html,
      );
      if (ogImageMatch?.[1]) {
        imageUrl = ogImageMatch[1];
        logger.debug('Using og:image fallback for Steam article', {
          gid,
          imageUrl,
        });
      }
    }

    // Cache the result (even if null) to avoid repeated failed attempts
    STEAM_IMAGE_CACHE.set(gid, { imageUrl, timestamp: Date.now() });
    return imageUrl;
  } catch (error) {
    logger.debug('Failed to fetch Steam article image', {
      url: articleUrl,
      gid,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Cache null result to prevent retry spam
    STEAM_IMAGE_CACHE.set(gid, { imageUrl: null, timestamp: Date.now() });
    return null;
  }
}

async function fetchWowheadArticleImage(
  articleUrl: string,
): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      env.WOWHEAD_IMAGE_FETCH_TIMEOUT,
    );

    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return undefined;

    const html = await response.text();

    const ogImageMatch = /<meta property="og:image" content="([^"]+)"/.exec(
      html,
    );
    if (ogImageMatch?.[1]) {
      return ogImageMatch[1];
    }

    const contentImgMatch =
      /<img[^>]+class="[^"]*news-image[^"]*"[^>]+src="([^"]+)"/.exec(html);
    if (contentImgMatch?.[1]) {
      return contentImgMatch[1];
    }

    return undefined;
  } catch (error) {
    logger.debug('Failed to fetch Wowhead article image', {
      url: articleUrl,
      error,
    });
    return undefined;
  }
}

/**
 * Fetch Steam news from API (without cache)
 * Uses feed filtering for higher quality content
 */
async function fetchSteamNews(
  appId: number,
  count = 5,
): Promise<SteamNewsItem[]> {
  // Filter for official announcements and blog posts only (higher quality)
  const feeds = 'steam_community_announcements,steam_community_blog';

  const response = await fetch(
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=${count}&feeds=${feeds}&format=json`,
  );

  if (!response.ok) {
    throw new Error(`Steam API returned ${response.status}`);
  }

  const rawData: unknown = await response.json();
  const data = SteamNewsResponseSchema.parse(rawData);
  return data.appnews.newsitems;
}

/**
 * Fetch Steam news with 15-minute cache
 */
async function fetchSteamNewsWithCache(
  appId: number,
  count = 5,
): Promise<SteamNewsItem[]> {
  const cached = STEAM_NEWS_CACHE.get(appId);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    steamNewsCacheHits++;
    logger.debug('Using cached Steam news', { appId });
    return cached.data;
  }
  steamNewsCacheMisses++;

  const items = await fetchSteamNews(appId, count);
  STEAM_NEWS_CACHE.set(appId, { data: items, timestamp: now });

  logger.debug('Fetched and cached Steam news', {
    appId,
    count: items.length,
    cacheUntil: new Date(now + CACHE_TTL).toISOString(),
  });

  return items;
}

async function fetchRSSNewsWithRetry(
  feedUrl: string,
  retries = 3,
): Promise<RSSFeedItem[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchRSSNews(feedUrl);
    } catch (error) {
      logger.warn(`RSS fetch attempt ${attempt}/${retries} failed`, {
        url: feedUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt,
      });

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt)),
      );
    }
  }

  return [];
}

async function fetchRSSNewsWithCache(feedUrl: string): Promise<RSSFeedItem[]> {
  const cached = RSS_CACHE.get(feedUrl);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    logger.debug('Using cached RSS feed', { url: feedUrl });
    return cached.data;
  }

  const items = await fetchRSSNewsWithRetry(feedUrl);
  RSS_CACHE.set(feedUrl, { data: items, timestamp: now });
  return items;
}

async function fetchRSSNews(feedUrl: string): Promise<RSSFeedItem[]> {
  const rawFeed = await extract(feedUrl);
  const feed = FeedResponseSchema.parse(rawFeed);

  if (!feed?.entries) {
    return [];
  }

  return Promise.all(
    feed.entries.map(async (rawEntry, index): Promise<RSSFeedItem> => {
      const entry = FeedEntrySchema.parse(rawEntry);

      let imageUrl: string | undefined;

      if (entry.enclosure?.url) {
        imageUrl = entry.enclosure.url;
      }

      if (!imageUrl && entry['media:content']) {
        const mediaContent = entry['media:content'];

        if (Array.isArray(mediaContent)) {
          const firstMedia = mediaContent[0];
          if (firstMedia?.url) {
            imageUrl = firstMedia.url;
          }
        } else {
          if (mediaContent?.url) {
            imageUrl = mediaContent.url;
          }
        }
      }

      if (!imageUrl && entry['media:thumbnail']?.url) {
        imageUrl = entry['media:thumbnail'].url;
      }

      if (!imageUrl && entry.description) {
        imageUrl = extractImageFromDescription(entry.description);
      }

      if (!imageUrl && entry.link?.includes('wowhead.com')) {
        imageUrl = await fetchWowheadArticleImage(entry.link);
      }

      let cleanDescription = entry.description ?? '';
      if (cleanDescription) {
        cleanDescription = cleanDescription.replace(/<[^>]*>/g, '');
        cleanDescription = cleanDescription
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#039;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/»/g, '')
          .replace(/«/g, '')
          .replace(/Continue reading/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanDescription.length > 400) {
          cleanDescription = cleanDescription.slice(0, 397) + '...';
        }
      }

      if (index === 0) {
        logger.debug('RSS feed entry debug:', {
          title: entry.title,
          hasEnclosure: !!entry.enclosure,
          enclosureUrl: entry.enclosure?.url,
          hasMediaContent: !!entry['media:content'],
          mediaContentType: Array.isArray(entry['media:content'])
            ? 'array'
            : typeof entry['media:content'],
          hasMediaThumbnail: !!entry['media:thumbnail'],
          hasDescription: !!entry.description,
          descriptionLength: entry.description?.length,
          descriptionPreview: entry.description?.substring(0, 500),
          extractedImage: imageUrl,
        });
      }

      return {
        guid: entry.id ?? entry.link ?? '',
        title: entry.title ?? 'News Update',
        link: entry.link ?? '',
        contentSnippet: cleanDescription,
        pubDate: entry.published ?? '',
        ...(imageUrl && { image: imageUrl }),
      };
    }),
  );
}

async function isNewsPosted(guid: string, guildId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(postedNews)
    .where(and(eq(postedNews.guid, guid), eq(postedNews.guildId, guildId)))
    .limit(1);

  return result.length > 0;
}

async function markNewsPosted(
  guid: string,
  source: string,
  guildId: string,
  messageId: string,
  title: string,
): Promise<void> {
  try {
    await db
      .insert(postedNews)
      .values({
        guid,
        source,
        guildId,
        messageId,
        title,
      })
      .onConflictDoNothing();
  } catch (error) {
    logger.error('Failed to mark news as posted', { guid, source, error });
  }
}

export async function cleanupOldPostedNews(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(postedNews)
      .where(lt(postedNews.postedAt, thirtyDaysAgo));

    const deleted = result.length;
    if (deleted > 0) {
      logger.info(`🗑️ Cleaned up ${deleted} old posted news entries`);
    }
    return deleted;
  } catch (error) {
    logger.error('Failed to cleanup old posted news', { error });
    return 0;
  }
}

async function getEnabledSources(guildId: string): Promise<Set<string>> {
  const settings = await db
    .select()
    .from(newsSettings)
    .where(
      and(eq(newsSettings.guildId, guildId), eq(newsSettings.enabled, true)),
    );

  if (settings.length === 0) {
    return new Set(Object.keys(AVAILABLE_NEWS_SOURCES));
  }

  return new Set(settings.map((s: NewsSetting) => s.source));
}

async function getNewsChannelForSource(
  guildId: string,
  source: string,
): Promise<string | null> {
  const setting = await db
    .select()
    .from(newsSettings)
    .where(
      and(
        eq(newsSettings.guildId, guildId),
        eq(newsSettings.source, source),
        eq(newsSettings.enabled, true),
      ),
    )
    .limit(1);

  const firstSetting = setting[0];
  if (firstSetting?.channelId) {
    return firstSetting.channelId;
  }

  const config = await getBotConfig();
  return config.newsChannelId ?? null;
}

/**
 * Clean Steam BBCode/HTML content while preserving paragraph structure
 */
function cleanSteamContent(html: string): string {
  if (!html) return '';

  let text = html;

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");

  text = text.replace(/\[\/p\]/gi, '\n\n');
  text = text.replace(/\[p\]/gi, '');
  text = text.replace(/\[\/h[1-6]\]/gi, '\n\n');
  text = text.replace(/\[h[1-6]\]/gi, '');
  text = text.replace(/\[\/list\]/gi, '\n');
  text = text.replace(/\[list\]/gi, '\n');
  text = text.replace(/\[\*\]/gi, '\n• ');
  text = text.replace(/\[\/\*\]/gi, '');
  text = text.replace(/\[\]\[\]/gi, '');
  text = text.replace(/\[\]/gi, '');

  text = text.replace(/\[b\]/gi, '');
  text = text.replace(/\[\/b\]/gi, '');
  text = text.replace(/\[i\]/gi, '');
  text = text.replace(/\[\/i\]/gi, '');
  text = text.replace(/\[u\]/gi, '');
  text = text.replace(/\[\/u\]/gi, '');
  text = text.replace(/\[strike\]/gi, '');
  text = text.replace(/\[\/strike\]/gi, '');

  text = text.replace(/\[url=[^\]]+\]([^\[]+)\[\/url\]/gi, '$1');
  text = text.replace(/\[url\]([^\[]+)\[\/url\]/gi, '$1');

  text = text.replace(/\[img\][^\[]+\[\/img\]/gi, '');

  text = text.replace(/\[quote[^\]]*\]/gi, '');
  text = text.replace(/\[\/quote\]/gi, '');

  text = text.replace(/\[code\]/gi, '');
  text = text.replace(/\[\/code\]/gi, '');

  text = text.replace(/\[[^\]]+\]/g, '');

  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  text = text.replace(/<[^>]*>/g, '');

  text = text.replace(/\\/g, '');

  text = text.replace(/ {2,}/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return text.trim();
}

export async function checkGameNews(
  client: Client,
  guildId?: string,
  sourceFilter?: NewsSourceKey,
): Promise<number> {
  const config = await getBotConfig();
  const defaultNewsChannelId = config.newsChannelId;

  if (!defaultNewsChannelId) {
    logger.debug('No default news channel configured');
    return 0;
  }

  const defaultChannel = await client.channels.fetch(defaultNewsChannelId);

  if (!defaultChannel) {
    logger.warn('Could not fetch default news channel', {
      channelId: defaultNewsChannelId,
    });
    return 0;
  }

  const channelGuildId =
    guildId ??
    ('guild' in defaultChannel ? defaultChannel.guild?.id : undefined);

  if (!channelGuildId) {
    logger.warn('Could not determine guild ID for news');
    return 0;
  }

  const enabledSources = await getEnabledSources(channelGuildId);
  let totalPosted = 0;

  for (const [key, source] of Object.entries(AVAILABLE_NEWS_SOURCES)) {
    if (sourceFilter && key !== sourceFilter) {
      continue;
    }

    if (!enabledSources.has(key)) {
      continue;
    }

    try {
      const channelId = await getNewsChannelForSource(channelGuildId, key);

      if (!channelId) {
        logger.debug(`No channel configured for source: ${key}`);
        continue;
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        logger.warn(`News channel for ${key} is not a text channel`, {
          channelId,
          source: key,
        });
        continue;
      }

      if (source.type === 'steam') {
        // Use cached Steam news API response
        const items = await fetchSteamNewsWithCache(source.appId);

        const newItems = await Promise.all(
          items.map(async (item) => ({
            item,
            isNew: !(await isNewsPosted(item.gid, channelGuildId)),
          })),
        );

        const itemsToPost = newItems
          .filter((x) => x.isNew)
          .map((x) => x.item)
          .reverse()
          .slice(0, 3);

        // Fetch images in parallel for all items to post
        const imageResults = await Promise.allSettled(
          itemsToPost.map((item) => {
            const isSteamCommunity = item.url.includes('steamcommunity.com');
            if (isSteamCommunity) {
              return fetchSteamArticleData(item.url, item.gid);
            }
            return Promise.resolve(null);
          }),
        );

        // Post each article with its fetched image
        for (let i = 0; i < itemsToPost.length; i++) {
          const item = itemsToPost[i];
          if (!item) continue; // Skip if item is undefined

          const imageResult = imageResults[i];
          if (!imageResult) continue; // Skip if result is undefined

          const isSteamCommunity = item.url.includes('steamcommunity.com');

          // Get image from parallel fetch result
          let imageUrl: string | null = null;
          if (isSteamCommunity && imageResult.status === 'fulfilled') {
            imageUrl = imageResult.value;
          }

          // Fallback to game header image if no article-specific image found
          imageUrl ??= `https://cdn.cloudflare.steamstatic.com/steam/apps/${source.appId}/header.jpg`;

          const cleanContent = cleanSteamContent(item.contents);
          const description =
            cleanContent.length > 400
              ? cleanContent.slice(0, 397) + '...'
              : cleanContent;

          // Use tags if available, otherwise feedlabel
          let footerText: string;
          if (item.tags && item.tags.length > 0 && item.tags[0]) {
            footerText = item.tags[0]; // Use primary tag
          } else if (item.feedlabel) {
            footerText = item.feedlabel;
          } else {
            footerText = isSteamCommunity ? 'Steam News' : 'External Article';
          }

          const embed = new EmbedBuilder()
            .setTitle(sanitizeDiscordText(item.title))
            .setURL(item.url)
            .setDescription(
              sanitizeDiscordDescription(description || 'Click to read more'),
            )
            .setColor(source.color)
            .setFooter({
              text: sanitizeDiscordText(footerText, 100),
            })
            .setTimestamp(item.date * 1000);

          if (imageUrl) {
            embed.setImage(imageUrl);
          }

          try {
            const message = await (channel as TextChannel).send({
              embeds: [embed],
            });
            await markNewsPosted(
              item.gid,
              key,
              channelGuildId,
              message.id,
              item.title,
            );
            totalPosted++;
            logger.debug(`Posted ${source.name} news to channel`, {
              channelId,
              itemId: item.gid,
              isSteamCommunity,
              hasImage: !!imageUrl,
              imageFetchSuccess: imageResult.status === 'fulfilled',
              tags: item.tags,
              feedLabel: item.feedlabel,
            });
          } catch (sendError) {
            logger.error(`Failed to post ${source.name} news to channel:`, {
              error: sendError,
              channelId,
              source: key,
            });
          }
        }
      } else if (source.type === 'rss') {
        const items = await fetchRSSNewsWithCache(source.url);

        if (items.length === 0) {
          logger.warn(`No items returned from RSS feed: ${source.name}`, {
            url: source.url,
            source: key,
          });
          continue;
        }

        const sortedItems = items
          .filter((item) => item.guid && item.pubDate)
          .sort((a, b) => {
            const dateA = new Date(a.pubDate).getTime();
            const dateB = new Date(b.pubDate).getTime();
            return dateA - dateB;
          });

        const newItems = await Promise.all(
          sortedItems.map(async (item) => ({
            item,
            isNew: !(await isNewsPosted(item.guid, channelGuildId)),
          })),
        );

        const itemsToPost = newItems
          .filter((x) => x.isNew)
          .map((x) => x.item)
          .slice(0, 5);

        for (const item of itemsToPost) {
          if (!item.guid) continue;

          const embed = new EmbedBuilder()
            .setTitle(sanitizeDiscordText(item.title))
            .setURL(item.link)
            .setDescription(
              sanitizeDiscordDescription(
                item.contentSnippet || 'Click to read more',
              ),
            )
            .setColor(source.color)
            .setFooter({
              text: sanitizeDiscordText(source.name, 100),
              iconURL: WOWHEAD_ICON,
            })
            .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date());

          if (item.image) {
            const isValidImage = await validateImageUrl(item.image);
            if (isValidImage) {
              embed.setImage(item.image);
            }
          }

          try {
            const message = await (channel as TextChannel).send({
              embeds: [embed],
            });
            await markNewsPosted(
              item.guid,
              key,
              channelGuildId,
              message.id,
              item.title,
            );
            totalPosted++;

            if (itemsToPost.indexOf(item) < itemsToPost.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }

            logger.debug(`Posted ${source.name} news to channel`, {
              channelId,
              itemId: item.guid,
              hasImage: !!item.image,
            });
          } catch (sendError) {
            logger.error(`Failed to post ${source.name} news to channel:`, {
              error: sendError,
              channelId,
              source: key,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error fetching news for ${key}:`, {
        error,
        source: key,
        type: source.type,
        url: source.type === 'rss' ? source.url : `Steam App ${source.appId}`,
      });
    }
  }

  if (totalPosted > 0) {
    logger.info(`📰 Posted ${totalPosted} news item(s)`, { totalPosted });
  } else {
    logger.debug('📰 News check complete - no new articles to post');
  }

  return totalPosted;
}

export async function toggleNewsSource(
  guildId: string,
  source: NewsSourceKey,
  enabled: boolean,
): Promise<void> {
  const existing = await db
    .select()
    .from(newsSettings)
    .where(
      and(eq(newsSettings.guildId, guildId), eq(newsSettings.source, source)),
    );

  if (existing.length > 0) {
    await db
      .update(newsSettings)
      .set({ enabled, updatedAt: new Date() })
      .where(
        and(eq(newsSettings.guildId, guildId), eq(newsSettings.source, source)),
      );
  } else {
    await db.insert(newsSettings).values({
      guildId,
      source,
      enabled,
    });
  }
}

export async function getNewsSourceStatus(
  guildId: string,
): Promise<Record<string, boolean>> {
  const settings = await db
    .select()
    .from(newsSettings)
    .where(eq(newsSettings.guildId, guildId));

  const status: Record<string, boolean> = {};

  for (const key of Object.keys(AVAILABLE_NEWS_SOURCES)) {
    status[key] = true;
  }

  for (const setting of settings) {
    status[setting.source] = setting.enabled;
  }

  return status;
}
