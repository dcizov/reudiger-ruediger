import {
  EmbedBuilder,
  type Client,
  type Channel,
  type TextChannel,
  type NewsChannel,
  type PublicThreadChannel,
  type PrivateThreadChannel,
} from "discord.js";
import { getDeals, type CheapSharkDeal } from "../utils/cheapshark";
import { getBotConfig } from "../utils/botConfig";
import {
  getItadGameId,
  getItadEurPrice,
  type ItadPrice,
} from "../utils/itadPrice.js";
import { getPostedDealIDs, addPostedDeal } from "../utils/postedDeals";
import { config as env } from "../config";

const storeNames: Record<string, string> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "GreenManGaming",
  "4": "Amazon",
  "5": "GameStop",
  "6": "Direct2Drive",
  "7": "GoG",
  "8": "Origin",
  "9": "Get Games",
  "10": "Shiny Loot",
  "11": "Humble Store",
  "12": "Desura",
  "13": "Uplay",
  "14": "IndieGameStand",
  "15": "Fanatical",
  "16": "Gamesrocket",
  "17": "Games Republic",
  "18": "SilaGames",
  "19": "Playfield",
  "20": "ImperialGames",
  "21": "WinGameStore",
  "22": "FunStockDigital",
  "23": "GameBillet",
  "24": "Voidu",
  "25": "Epic Games Store",
  "26": "Razer Game Store",
  "27": "Gamesplanet",
  "28": "Gamesload",
  "29": "2Game",
  "30": "IndieGala",
  "31": "Blizzard Shop",
  "32": "AllYouPlay",
  "33": "DLGamer",
  "34": "Noctre",
  "35": "DreamGame",
  "36": "Game Jolt",
};

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

export async function postNewDeals(client: Client, limit = 5): Promise<number> {
  const config = await getBotConfig();
  if (!config.dealsChannelId) return 0;

  const deals = await getDeals(limit);
  if (!deals.length) return 0;

  const postedIDs = await getPostedDealIDs();
  const newDeals = deals.filter(
    (deal: CheapSharkDeal) => !postedIDs.includes(deal.dealID)
  );
  if (!newDeals.length) return 0;

  const channel = await client.channels.fetch(config.dealsChannelId);
  if (!isSendableChannel(channel)) return 0;

  const apiKey: string = env.ITAD_API_KEY ?? "";
  if (!apiKey) {
    console.error("ITAD_API_KEY is not set");
    return 0;
  }

  let postedCount = 0;

  for (const deal of newDeals) {
    let eurPrice: ItadPrice | null = null;
    try {
      const gameId = await getItadGameId(apiKey, deal.title);
      if (gameId) {
        eurPrice = await getItadEurPrice(apiKey, gameId, "DE");
      }
    } catch (err) {
      console.warn(`ITAD lookup failed for "${deal.title}":`, err);
    }

    const platform = storeNames[deal.storeID] || "Unknown";
    const imageUrl = deal.steamAppID
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
      : deal.thumb;
    const savings = deal.savings
      ? `${parseFloat(deal.savings).toFixed(0)}%`
      : "N/A";

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${deal.title}`)
      .setURL(
        eurPrice?.url ||
          `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`
      )
      .setImage(imageUrl)
      .setColor(0x00ae86)
      .addFields(
        {
          name: "💰 Sale Price",
          value: eurPrice ? `€${eurPrice.price_new}` : "Check Deal",
          inline: true,
        },
        {
          name: "💸 Normal Price",
          value: eurPrice ? `~~€${eurPrice.price_old}~~` : "N/A",
          inline: true,
        },
        { name: "📉 Savings", value: `-${savings}`, inline: true },
        {
          name: "🏪 Store",
          value: eurPrice ? eurPrice.shop : platform,
          inline: true,
        },
        { name: "🎯 Platform", value: platform, inline: true },
        {
          name: "⭐ Deal Rating",
          value: deal.dealRating
            ? `${parseFloat(deal.dealRating).toFixed(1)}/10`
            : "N/A",
          inline: true,
        },
        {
          name: "🔗 Links",
          value: eurPrice
            ? `[🛒 Open Deal](${eurPrice.url}) • [🎮 View on Steam](https://store.steampowered.com/app/${deal.steamAppID || ""})`
            : `[🛒 Open Deal](https://www.cheapshark.com/redirect?dealID=${deal.dealID})${deal.steamAppID ? ` • [🎮 View on Steam](https://store.steampowered.com/app/${deal.steamAppID})` : ""}`,
          inline: false,
        }
      )
      .setFooter({
        text: "💡 EUR prices from IsThereAnyDeal • Prices may vary by region",
        iconURL: "https://isthereanydeal.com/assets/favicon.png",
      })
      .setTimestamp();

    try {
      const message = await channel.send({ embeds: [embed] });

      await addPostedDeal({
        dealId: deal.dealID,
        messageId: message.id,
        title: deal.title,
        store: eurPrice?.shop ?? platform,
        platform,
        salePrice: eurPrice ? String(eurPrice.price_new) : null,
        normalPrice: eurPrice ? String(eurPrice.price_old) : null,
        savings,
        dealRating: deal.dealRating ? String(deal.dealRating) : null,
        imageUrl,
        url:
          eurPrice?.url ||
          `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
        postedAt: new Date(),
      });
      postedCount++;
    } catch (err) {
      console.error(`Failed to post deal ${deal.dealID}:`, err);
    }
  }

  return postedCount;
}