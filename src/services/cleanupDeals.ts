import {
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from "discord.js";
import { getBotConfig } from "../utils/botConfig";
import { getDeals, type CheapSharkDeal } from "../utils/cheapshark";
import {
  getPostedDeals,
  removePostedDeal,
  type PostedDeal,
} from "../utils/postedDeals";

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
    typeof (
      channel as
        | TextChannel
        | NewsChannel
        | PublicThreadChannel
        | PrivateThreadChannel
    ).send === "function"
  );
}

export async function cleanupExpiredDeals(client: Client): Promise<number> {
  const config = await getBotConfig();
  if (!config.dealsChannelId) return 0;

  try {
    const currentDeals: CheapSharkDeal[] = await getDeals(100);
    const currentDealIDs = new Set(currentDeals.map((d) => d.dealID));
    const postedDealsList: PostedDeal[] = await getPostedDeals();

    const channel = await client.channels.fetch(config.dealsChannelId);
    if (!channel || !isSendableChannel(channel)) return 0;

    let removedCount = 0;

    for (const posted of postedDealsList) {
      if (!currentDealIDs.has(posted.dealId)) {
        let messageDeleted = false;
        try {
          const message = await channel.messages.fetch(posted.messageId);
          await message.delete();
          messageDeleted = true;
        } catch (err) {
          // Message might already be deleted or bot lacks permissions
          console.warn(
            `[cleanup] Could not delete message ${posted.messageId} for deal ${posted.dealId}:`,
            err
          );
        }
        // Always remove from the database, even if message deletion failed
        await removePostedDeal(posted.dealId);
        removedCount++;
        console.log(
          `[cleanup] Removed deal ${posted.dealId} from DB${messageDeleted ? " and Discord" : ""}`
        );
      }
    }
    return removedCount;
  } catch (err) {
    console.error("Error during cleanup:", err);
    return 0;
  }
}
