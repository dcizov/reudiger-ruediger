import {
  EmbedBuilder,
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from 'discord.js';

import { env } from '../config';
import { getBotConfig } from '../utils/botConfig';
import { getDeals } from '../utils/cheapshark';
import {
  getItadEurPrices,
  getItadGameId,
  getItadHistoricalLowBatch,
} from '../utils/itadPrice';
import { logger } from '../utils/logger';
import { addPostedDeal, getPostedDealIDs } from '../utils/postedDeals';
import { storeNames } from '../utils/stores';

// Fix: Remove 'any' types with proper type checking
function isSendableChannel(
  channel: Channel | null,
): channel is
  | TextChannel
  | NewsChannel
  | PublicThreadChannel
  | PrivateThreadChannel {
  if (!channel) return false;

  // Use 'in' operator for type checking instead of 'any'
  if (!('send' in channel)) return false;
  if (typeof channel.send !== 'function') return false;
  if (!('messages' in channel)) return false;

  return true;
}

export async function postNewDeals(
  client: Client,
  maxDeals = 5,
): Promise<number> {
  const config = await getBotConfig();
  if (!config.dealsChannelId) {
    logger.warn('⚠️ No deals channel configured');
    return 0;
  }

  const rawDeals = await getDeals(100);
  logger.info(`📊 Fetched ${rawDeals.length} raw deals from CheapShark`, {
    rawDealsCount: rawDeals.length,
  });

  const postedIDs = new Set(await getPostedDealIDs());
  logger.info(`🗄️ Found ${postedIDs.size} previously posted deals in DB`, {
    postedIDsCount: postedIDs.size,
  });

  const newDeals = rawDeals.filter((deal) => !postedIDs.has(deal.dealID));
  logger.info(
    `🆕 Filtered to ${newDeals.length} new deals (not posted before)`,
    { newDealsCount: newDeals.length },
  );

  if (!newDeals.length) return 0;

  const apiKey = env.ITAD_API_KEY;
  if (!apiKey) {
    logger.warn('⚠️ No ITAD API key configured');
    return 0;
  }

  const channel = await client.channels.fetch(config.dealsChannelId);
  if (!isSendableChannel(channel)) {
    logger.warn('⚠️ Deals channel is not a valid text channel');
    return 0;
  }

  // Batch game ID lookups in chunks for better performance
  const titleToGameId = new Map<string, string>();
  const CHUNK_SIZE = 10; // Process 10 games at a time

  for (let i = 0; i < newDeals.length; i += CHUNK_SIZE) {
    const chunk = newDeals.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (deal) => {
        const id = await getItadGameId(apiKey, deal.title);
        if (id) titleToGameId.set(deal.dealID, id);
      }),
    );
  }
  logger.info(
    `🎮 Matched ${titleToGameId.size}/${newDeals.length} games to ITAD IDs`,
    { matched: titleToGameId.size, total: newDeals.length },
  );

  const gameIDs = Array.from(titleToGameId.values());
  const eurPrices = await getItadEurPrices(apiKey, gameIDs);
  logger.info(`💶 Got EUR prices for ${Object.keys(eurPrices).length} games`, {
    eurPricesCount: Object.keys(eurPrices).length,
  });

  const historicalData = await getItadHistoricalLowBatch(
    apiKey,
    gameIDs,
    'DE',
    client,
  );
  logger.info(
    `📊 Got historical data for ${Object.keys(historicalData).length} games`,
    { historicalDataCount: Object.keys(historicalData).length },
  );

  const enriched = newDeals
    .map((deal) => {
      const gameId = titleToGameId.get(deal.dealID);
      if (!gameId) return null;

      const eurPrice = eurPrices[gameId];
      if (!eurPrice) return null;

      const historical = historicalData[gameId] ?? {
        price: eurPrice.price_new,
        isLowest: false,
      };

      const discount = parseFloat(deal.savings);
      const rating = parseFloat(deal.dealRating ?? '0');
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
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const sorted = enriched.sort((a, b) => b.score - a.score).slice(0, maxDeals);

  logger.info(`✅ Enriched and scored ${sorted.length} deals ready to post`, {
    sortedCount: sorted.length,
  });

  let posted = 0;

  for (const entry of sorted) {
    const { deal, eurPrice, historical } = entry; // Fix: Remove unused gameId
    const platform = storeNames[deal.storeID] ?? 'Unknown'; // Fix: Use ?? instead of ||
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
          name: '💰 Sale Price',
          value: `€${eurPrice.price_new.toFixed(2)}`,
          inline: true,
        },
        {
          name: '💸 Normal Price',
          value: `~~€${eurPrice.price_old.toFixed(2)}~~`,
          inline: true,
        },
        { name: '📉 Discount', value: `-${savings}`, inline: true },
        { name: '🏪 Store', value: eurPrice.shop, inline: true },
        {
          name: '⭐ Rating',
          value: deal.dealRating
            ? `${parseFloat(deal.dealRating).toFixed(1)}/10`
            : 'N/A',
          inline: true,
        },
        {
          name: '🔗 Links',
          value: `[🛒 Deal](${eurPrice.url})${deal.steamAppID ? ` • [🎮 Steam](https://store.steampowered.com/app/${deal.steamAppID})` : ''}`,
          inline: false,
        },
        {
          name: '📉 Historical Low',
          value: `€${historical.price.toFixed(2)} • ${
            historical.isLowest ? '**New All-Time Low!**' : 'Not lowest'
          }`,
          inline: true,
        },
      )
      .setFooter({
        text: 'Prices via IsThereAnyDeal.com • EU Region',
        iconURL: 'https://isthereanydeal.com/assets/favicon.png',
      })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });

    // Fix: Properly type check the error
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
    }).catch((err: unknown) => {
      // Fix: Properly check error type
      if (err instanceof Error && err.message.includes('duplicate key')) {
        // Silently ignore duplicate key errors
        return;
      }
      throw err;
    });

    posted++;
  }

  return posted;
}
