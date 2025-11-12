import { extract } from '@extractus/feed-extractor';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { newsSettings } from '../db/schema';
import {
  FeedEntrySchema,
  FeedResponseSchema,
  SteamNewsResponseSchema,
  type RSSFeedItem,
  type SteamNewsItem,
} from '../schemas/news';
import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';

const POSTED_NEWS_IDS = new Set<string>();

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
} as const;

export type NewsSourceKey = keyof typeof AVAILABLE_NEWS_SOURCES;

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

async function fetchRSSNews(feedUrl: string): Promise<RSSFeedItem[]> {
  const rawFeed = await extract(feedUrl);
  const feed = FeedResponseSchema.parse(rawFeed);

  if (!feed?.entries) {
    return [];
  }

  return feed.entries.map((rawEntry): RSSFeedItem => {
    const entry = FeedEntrySchema.parse(rawEntry);

    let imageUrl: string | undefined;

    if (entry.enclosure?.url) {
      imageUrl = entry.enclosure.url;
    }

    if (!imageUrl && entry['media:content']) {
      const media = Array.isArray(entry['media:content'])
        ? entry['media:content'][0]
        : entry['media:content'];
      if (media?.url) {
        imageUrl = media.url;
      }
    }

    if (!imageUrl && entry['media:thumbnail']?.url) {
      imageUrl = entry['media:thumbnail'].url;
    }

    return {
      guid: entry.id ?? entry.link ?? '',
      title: entry.title ?? 'News Update',
      link: entry.link ?? '',
      contentSnippet: entry.description ?? '',
      pubDate: entry.published ?? '',
      ...(imageUrl && { image: imageUrl }),
    };
  });
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

/**
 * Get the configured news channel for a specific source
 * Falls back to default news channel if no source-specific channel is set
 */
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

  if (setting[0]?.channelId) {
    return setting[0].channelId;
  }

  const config = await getBotConfig();
  return config.newsChannelId ?? null;
}

export async function checkGameNews(
  client: Client,
  guildId?: string,
): Promise<number> {
  const config = await getBotConfig();
  const defaultNewsChannelId = config.newsChannelId;

  if (!defaultNewsChannelId) {
    logger.debug('No default news channel configured');
    return 0;
  }

  // Fetch and validate default channel
  const defaultChannel = await client.channels.fetch(defaultNewsChannelId);

  if (!defaultChannel) {
    logger.warn('Could not fetch default news channel', {
      channelId: defaultNewsChannelId,
    });
    return 0;
  }

  // Determine guild ID from provided param or channel
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
    if (!enabledSources.has(key)) {
      continue;
    }

    try {
      // Get source-specific channel OR fall back to default
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
        const newItems = items.filter((item) => !POSTED_NEWS_IDS.has(item.gid));

        for (const item of newItems.reverse().slice(0, 3)) {
          const imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${source.appId}/capsule_616x353.jpg`;

          const embed = new EmbedBuilder()
            .setTitle(`${source.icon} ${item.title}`)
            .setURL(item.url)
            .setDescription(
              item.contents.slice(0, 400) +
                (item.contents.length > 400 ? '...' : ''),
            )
            .setColor(source.color)
            .setImage(imageUrl)
            .addFields(
              {
                name: '📰 Source',
                value: item.feedlabel || source.name,
                inline: true,
              },
              {
                name: '✍️ Author',
                value: item.author || 'Official',
                inline: true,
              },
            )
            .setFooter({ text: source.name })
            .setTimestamp(item.date * 1000);

          try {
            await (channel as TextChannel).send({ embeds: [embed] });
            POSTED_NEWS_IDS.add(item.gid);
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
        const items = await fetchRSSNews(source.url);

        if (items.length === 0) {
          logger.warn(`No items returned from RSS feed: ${source.name}`, {
            url: source.url,
            source: key,
          });
          continue;
        }

        const newItems = items.filter(
          (item) => item.guid && !POSTED_NEWS_IDS.has(item.guid),
        );

        for (const item of newItems.slice(0, 3)) {
          if (!item.guid) continue;

          const embed = new EmbedBuilder()
            .setTitle(`${source.icon} ${item.title}`)
            .setURL(item.link)
            .setDescription(item.contentSnippet.slice(0, 400))
            .setColor(source.color)
            .setFooter({ text: source.name })
            .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date());

          if (item.image) {
            embed.setImage(item.image);
          }

          try {
            await (channel as TextChannel).send({ embeds: [embed] });
            POSTED_NEWS_IDS.add(item.guid);
            totalPosted++;
            logger.debug(`Posted ${source.name} news to channel`, {
              channelId,
              itemId: item.guid,
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
