import {
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from 'discord.js';

import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';
import { getPostedDeals, removePostedDeal } from '../utils/postedDeals';

function isSendableChannel(
  channel: Channel | null,
): channel is
  | TextChannel
  | NewsChannel
  | PublicThreadChannel
  | PrivateThreadChannel {
  if (!channel) return false;

  if (!('send' in channel)) return false;
  if (typeof channel.send !== 'function') return false;
  if (!('messages' in channel)) return false;

  return true;
}

export async function cleanupExpiredDeals(
  client: Client,
  isManual = false,
): Promise<number> {
  const config = await getBotConfig();
  const postedDeals = await getPostedDeals();
  const now = new Date();

  const expired = postedDeals.filter(
    (deal) => deal.expiresAt && deal.expiresAt < now,
  );
  if (!expired.length) return 0;

  const channel = await client.channels.fetch(config.dealsChannelId ?? '');
  if (!isSendableChannel(channel)) return 0;

  let removed = 0;

  for (const deal of expired) {
    try {
      const msg = await channel.messages.fetch(deal.messageId);
      await msg.delete();
    } catch (error) {
      logger.debug(
        `Could not delete message ${deal.messageId} for deal "${deal.title}":`,
        { messageId: deal.messageId, dealTitle: deal.title, error },
      );
    }
    await removePostedDeal(deal.dealId);
    removed++;
  }

  if (removed > 0) {
    logger.info(
      `🧹 Cleaned up ${removed} expired deal(s)${isManual ? ' (manual)' : ' (scheduled)'}`,
      { removed, isManual },
    );
  }

  return removed;
}
