import { z } from 'zod';

export const SteamNewsItemSchema = z.object({
  gid: z.string(),
  title: z.string(),
  url: z.string(),
  author: z.string(),
  contents: z.string(),
  date: z.number(),
  feedlabel: z.string(),
});

export const SteamNewsResponseSchema = z.object({
  appnews: z.object({
    newsitems: z.array(SteamNewsItemSchema),
  }),
});

const MediaItemSchema = z.object({
  url: z.string().optional(),
  type: z.string().optional(),
  width: z.string().or(z.number()).optional(),
  height: z.string().or(z.number()).optional(),
});

const EnclosureSchema = z.object({
  url: z.string().optional(),
  type: z.string().optional(),
  length: z.string().or(z.number()).optional(),
});

export const FeedEntrySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    link: z.string().optional(),
    description: z.string().optional(),
    published: z.string().optional(),
    enclosure: EnclosureSchema.optional(),
    'media:content': z
      .union([MediaItemSchema, z.array(MediaItemSchema)])
      .optional(),
    'media:thumbnail': MediaItemSchema.optional(),
  })
  .catchall(z.unknown());

export const FeedResponseSchema = z.object({
  entries: z.array(FeedEntrySchema).optional(),
  title: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
});

export const RSSFeedItemSchema = z.object({
  guid: z.string(),
  title: z.string(),
  link: z.string(),
  contentSnippet: z.string(),
  pubDate: z.string(),
  image: z.string().optional(),
});

export type SteamNewsItem = z.infer<typeof SteamNewsItemSchema>;
export type SteamNewsResponse = z.infer<typeof SteamNewsResponseSchema>;
export type FeedEntry = z.infer<typeof FeedEntrySchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
export type RSSFeedItem = z.infer<typeof RSSFeedItemSchema>;
