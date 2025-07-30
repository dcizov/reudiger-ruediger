import {
  EmbedBuilder,
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from "discord.js";
import { config as env } from "../config";
import { getBotConfig } from "../utils/botConfig";
import { getDeals } from "../utils/cheapshark";
import {
  getItadEurPrices,
  getItadGameId,
  getItadHistoricalLow,
} from "../utils/itadPrice";
import { addPostedDeal, getPostedDealIDs } from "../utils/postedDeals";
import { storeNames } from "../utils/stores";

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

export async function postNewDeals(
  client: Client,
  maxDeals = 5
): Promise<number> {
  const config = await getBotConfig();
  if (!config.dealsChannelId) return 0;

  const rawDeals = await getDeals(100);
  const postedIDs = new Set(await getPostedDealIDs());
  const newDeals = rawDeals.filter((deal) => !postedIDs.has(deal.dealID));
  if (!newDeals.length) return 0;

  const apiKey = env.ITAD_API_KEY;
  if (!apiKey) return 0;

  const channel = await client.channels.fetch(config.dealsChannelId);
  if (!isSendableChannel(channel)) return 0;

  const titleToGameId = new Map<string, string>();
  for (const deal of newDeals) {
    const id = await getItadGameId(apiKey, deal.title);
    if (id) titleToGameId.set(deal.dealID, id);
  }

  const gameIDs = Array.from(titleToGameId.values());
  const eurPrices = await getItadEurPrices(apiKey, gameIDs);

  const enriched = await Promise.all(
    newDeals.map(async (deal) => {
      const gameId = titleToGameId.get(deal.dealID);
      if (!gameId) return null;

      const eurPrice = eurPrices[gameId];
      if (!eurPrice) return null;

      const historical = await getItadHistoricalLow(apiKey, gameId);
      if (!historical) return null;

      const discount = parseFloat(deal.savings);
      const rating = parseFloat(deal.dealRating || "0");
      const price = eurPrice.price_new;

      const score = discount * 2 + rating - price * 0.3;

      return {
        gameId,
        deal,
        eurPrice,
        score,
        historical,
      };
    })
  );

  const sorted = enriched
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, maxDeals);

  let posted = 0;

  for (const entry of sorted) {
    const { deal, eurPrice, historical, gameId } = entry!;
    const platform = storeNames[deal.storeID] || "Unknown";
    const imageUrl = deal.steamAppID
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
      : deal.thumb;

    const savings = `${parseFloat(deal.savings).toFixed(0)}%`;

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${deal.title}`)
      .setURL(eurPrice.url)
      .setImage(imageUrl)
      .setColor(0x00ae86)
      .addFields(
        {
          name: "💰 Sale Price",
          value: `€${eurPrice.price_new.toFixed(2)}`,
          inline: true,
        },
        {
          name: "💸 Normal Price",
          value: `~~€${eurPrice.price_old.toFixed(2)}~~`,
          inline: true,
        },
        { name: "📉 Discount", value: `-${savings}`, inline: true },
        { name: "🏪 Store", value: eurPrice.shop, inline: true },
        {
          name: "⭐ Rating",
          value: deal.dealRating
            ? `${parseFloat(deal.dealRating).toFixed(1)}/10`
            : "N/A",
          inline: true,
        },
        {
          name: "🔗 Links",
          value: `[🛒 Deal](${eurPrice.url})${deal.steamAppID ? ` • [🎮 Steam](https://store.steampowered.com/app/${deal.steamAppID})` : ""}`,
          inline: false,
        },
        {
          name: "📉 Historical Low",
          value: `€${historical.price.toFixed(2)} • ${
            historical.isLowest ? "**New All-Time Low!**" : "Not lowest"
          }`,
          inline: true,
        }
      )
      .setFooter({
        text: "Prices via IsThereAnyDeal.com • EU Region",
        iconURL: "https://isthereanydeal.com/assets/favicon.png",
      })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });

    await addPostedDeal({
      dealId: deal.dealID,
      messageId: message.id,
      title: deal.title,
      store: eurPrice.shop,
      platform,
      salePrice: eurPrice.price_new.toFixed(2),
      normalPrice: eurPrice.price_old.toFixed(2),
      savings,
      dealRating: deal.dealRating,
      imageUrl,
      url: eurPrice.url,
      postedAt: new Date(),
      postedPrice: eurPrice.price_new,
      lowestEver: historical.isLowest,
      historicalLow: historical.price,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
    });

    posted++;
  }

  return posted;
}
