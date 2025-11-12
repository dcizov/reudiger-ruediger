import { extract } from '@extractus/feed-extractor';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { newsSettings } from '../db/schema';
import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';

const POSTED_NEWS_IDS = new Set<string>();

interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  date: number;
  feedlabel: string;
}

interface SteamNewsResponse {
  appnews: {
    newsitems: SteamNewsItem[];
  };
}

export const AVAILABLE_NEWS_SOURCES = {
  // Steam Games
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

  // World of Warcraft
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

  const data = (await response.json()) as SteamNewsResponse;
  return data.appnews.newsitems;
}

async function fetchRSSNews(feedUrl: string) {
  // extract() returns properly typed Feed object with all fields typed correctly
  const feed = await extract(feedUrl);

  if (!feed?.entries) {
    return [];
  }

  // All fields are properly typed - no type assertions needed!
  return feed.entries.map((entry) => ({
    guid: entry.id ?? entry.link ?? '',
    title: entry.title ?? 'News Update',
    link: entry.link ?? '',
    contentSnippet: entry.description ?? '',
    pubDate: entry.published ?? '',
  }));
}

async function getEnabledSources(guildId: string): Promise<Set<string>> {
  const settings = await db
    .select()
    .from(newsSettings)
    .where(
      and(eq(newsSettings.guildId, guildId), eq(newsSettings.enabled, true)),
    );

  // If no settings exist, enable all by default
  if (settings.length === 0) {
    return new Set(Object.keys(AVAILABLE_NEWS_SOURCES));
  }

  return new Set(settings.map((s) => s.source));
}

export async function checkGameNews(
  client: Client,
  guildId?: string,
): Promise<number> {
  const config = await getBotConfig();
  const newsChannelId = config.newsChannelId;

  if (!newsChannelId) {
    logger.debug('No news channel configured');
    return 0;
  }

  const channel = await client.channels.fetch(newsChannelId);
  if (!channel?.isTextBased()) {
    logger.warn('News channel is not a text channel');
    return 0;
  }

  // Get guild ID from channel
  const channelGuildId =
    guildId ?? ('guild' in channel ? channel.guild?.id : undefined);
  if (!channelGuildId) {
    logger.warn('Could not determine guild ID for news');
    return 0;
  }

  const enabledSources = await getEnabledSources(channelGuildId);
  let totalPosted = 0;

  for (const [key, source] of Object.entries(AVAILABLE_NEWS_SOURCES)) {
    // Skip disabled sources
    if (!enabledSources.has(key)) {
      continue;
    }

    try {
      if (source.type === 'steam') {
        const items = await fetchSteamNews(source.appId);
        const newItems = items.filter((item) => !POSTED_NEWS_IDS.has(item.gid));

        for (const item of newItems.reverse().slice(0, 3)) {
          const embed = new EmbedBuilder()
            .setTitle(`${source.icon} ${item.title}`)
            .setURL(item.url)
            .setDescription(
              item.contents.slice(0, 400) +
                (item.contents.length > 400 ? '...' : ''),
            )
            .setColor(source.color)
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

          await (channel as TextChannel).send({ embeds: [embed] });
          POSTED_NEWS_IDS.add(item.gid);
          totalPosted++;
        }
      } else if (source.type === 'rss') {
        const items = await fetchRSSNews(source.url);
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

          await (channel as TextChannel).send({ embeds: [embed] });
          POSTED_NEWS_IDS.add(item.guid);
          totalPosted++;
        }
      }
    } catch (error) {
      logger.error(`Error fetching news for ${key}:`, { error });
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

  // Default all to enabled
  for (const key of Object.keys(AVAILABLE_NEWS_SOURCES)) {
    status[key] = true;
  }

  // Override with actual settings
  for (const setting of settings) {
    status[setting.source] = setting.enabled;
  }

  return status;
}
