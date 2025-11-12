import { extract } from '@extractus/feed-extractor';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { and, eq, lt } from 'drizzle-orm';

import { db } from '../db';
import { newsSettings, postedNews } from '../db/schema';
import {
  FeedEntrySchema,
  FeedResponseSchema,
  SteamNewsResponseSchema,
  type RSSFeedItem,
  type SteamNewsItem,
} from '../schemas/news';
import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';

interface RSSCacheEntry {
  data: RSSFeedItem[];
  timestamp: number;
}

const RSS_CACHE = new Map<string, RSSCacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;

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

  // 1. Try standard img src
  const imgRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  // 2. Try data-src (lazy loading)
  const dataSrcRegex = /<img[^>]+data-src=["']([^"'>]+)["'][^>]*>/gi;
  while ((match = dataSrcRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  // 3. Try og:image meta tag (Wowhead often uses this)
  const ogImageRegex =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"'>]+)["'][^>]*>/gi;
  while ((match = ogImageRegex.exec(description)) !== null) {
    const url = match[1];
    if (url) {
      allMatches.push(url);
    }
  }

  if (allMatches.length === 0) return undefined;

  // Filter out small icons, logos, and Wowhead-specific assets
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
      lowerUrl.includes('/static/') // Wowhead static assets
    ) {
      continue;
    }

    // Prefer images from Wowhead's CDN (wow.zamimg.com)
    if (lowerUrl.includes('zamimg.com') && lowerUrl.includes('/uploads/')) {
      return url;
    }
  }

  // Fallback to first non-filtered image
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

async function fetchWowheadArticleImage(
  articleUrl: string,
): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return undefined;

    const html = await response.text();

    // Extract og:image meta tag (most reliable for Wowhead)
    const ogImageMatch = /<meta property="og:image" content="([^"]+)"/.exec(
      html,
    );
    if (ogImageMatch?.[1]) {
      return ogImageMatch[1];
    }

    // Fallback: first large image in article content
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

async function fetchSteamNews(
  appId: number,
  count = 5,
): Promise<SteamNewsItem[]> {
  const response = await fetch(
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=${count}&maxlength=500&format=json`,
  );

  if (!response.ok) {
    throw new Error(`Steam API returned ${response.status}`);
  }

  const rawData: unknown = await response.json();
  const data = SteamNewsResponseSchema.parse(rawData);
  return data.appnews.newsitems;
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

      // ✅ ADD THIS BLOCK HERE (after line 329)
      // 5. If still no image, fetch from article page (for Wowhead)
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
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanDescription.length > 400) {
          cleanDescription = cleanDescription.slice(0, 397) + '...';
        }
      }

      // Debug logging for first entry
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

  return new Set(settings.map((s) => s.source));
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
        const items = await fetchSteamNews(source.appId);
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

        for (const item of itemsToPost) {
          const imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${source.appId}/capsule_616x353.jpg`;

          const embed = new EmbedBuilder()
            .setTitle(item.title)
            .setURL(item.url)
            .setDescription(
              item.contents
                .replace(/\\/g, '')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 400) + (item.contents.length > 400 ? '...' : ''),
            )
            .setColor(source.color)
            .setImage(imageUrl)
            .setFooter({ text: source.name })
            .setTimestamp(item.date * 1000);

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

        const newItems = await Promise.all(
          items
            .filter((item) => item.guid)
            .map(async (item) => ({
              item,
              isNew: !(await isNewsPosted(item.guid, channelGuildId)),
            })),
        );

        const itemsToPost = newItems
          .filter((x) => x.isNew)
          .map((x) => x.item)
          .slice(0, 3);

        for (const item of itemsToPost) {
          if (!item.guid) continue;

          const embed = new EmbedBuilder()
            .setTitle(item.title)
            .setURL(item.link)
            .setDescription(item.contentSnippet || 'Click to read more')
            .setColor(source.color)
            .setFooter({
              text: `${source.name} • Published`,
              iconURL: WOWHEAD_ICON,
            })
            .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date());

          if (item.image) {
            const isValidImage = await validateImageUrl(item.image);
            if (isValidImage) {
              embed.setImage(item.image);
            } else {
              logger.debug('Invalid image URL, skipping', {
                url: item.image,
                title: item.title,
              });
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
