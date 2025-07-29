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
    // Get current deals from CheapShark
    const currentDeals: CheapSharkDeal[] = await getDeals(100); // Get more to check against
    const currentDealIDs = new Set(
      currentDeals.map((d: CheapSharkDeal) => d.dealID)
    );

    // Get our posted deals
    const postedDeals: PostedDeal[] = await getPostedDeals();

    // Get the channel
    const channel = await client.channels.fetch(config.dealsChannelId);
    if (!channel || !isSendableChannel(channel)) return 0;

    let removedCount = 0;

    for (const posted of postedDeals) {
      // If deal is no longer in current deals, it's expired
      if (!currentDealIDs.has(posted.dealID)) {
        try {
          // Delete the message
          const message = await channel.messages.fetch(posted.messageID);
          await message.delete();

          // Remove from our tracking
          await removePostedDeal(posted.dealID);

          removedCount++;
          console.log(`Removed expired deal: ${posted.dealID}`);
        } catch (err) {
          // Message might already be deleted or we don't have permissions
          console.warn(`Could not delete message ${posted.messageID}:`, err);
          // Still remove from tracking
          await removePostedDeal(posted.dealID);
        }
      }
    }

    return removedCount;
  } catch (err) {
    console.error("Error during cleanup:", err);
    return 0;
  }
}
