import {
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from "discord.js";
import { getBotConfig } from "../utils/botConfig";
import { getPostedDeals, removePostedDeal } from "../utils/postedDeals";

function isSendableChannel(
  channel: Channel | null
): channel is
  | TextChannel
  | NewsChannel
  | PublicThreadChannel
  | PrivateThreadChannel {
  return (
    !!channel &&
    "send" in channel &&
    typeof (channel as any).send === "function" &&
    "messages" in channel &&
    typeof (channel as any).messages?.fetch === "function"
  );
}

export async function cleanupExpiredDeals(client: Client): Promise<number> {
  const config = await getBotConfig();
  const postedDeals = await getPostedDeals();
  const now = new Date();

  const expired = postedDeals.filter(
    (deal) => deal.expiresAt && deal.expiresAt < now
  );
  if (!expired.length) return 0;

  const channel = await client.channels.fetch(config.dealsChannelId ?? "");
  if (!isSendableChannel(channel)) return 0;

  let removed = 0;

  for (const deal of expired) {
    try {
      const msg = await channel.messages.fetch(deal.messageId);
      await msg.delete();
    } catch {}
    await removePostedDeal(deal.dealId);
    removed++;
  }

  return removed;
}
