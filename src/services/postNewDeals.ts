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

// Quality thresholds (based on real-world deal bots)
const MIN_DISCOUNT_PERCENT = 70; // Only post deals ≥70% off
const MIN_RATING_FOR_LOWER_DISCOUNT = 7.0; // If rating ≥7, allow ≥50% discount
const MIN_DISCOUNT_FOR_GOOD_RATING = 50; // Minimum discount for highly-rated games

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

  // Batch game ID lookups
  const titleToGameId = new Map<string, string>();
  const CHUNK_SIZE = 10;

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
        discount,
        rating,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Apply quality filters (based on real-world deal bots)
  const qualityDeals = enriched.filter((item) => {
    const { discount, rating, historical } = item;

    // Always post historical lows with decent discount
    if (historical.isLowest && discount >= 50) {
      return true;
    }

    // High discount deals (≥70%)
    if (discount >= MIN_DISCOUNT_PERCENT) {
      return true;
    }

    // Highly-rated games with good discount (≥50%)
    if (
      rating >= MIN_RATING_FOR_LOWER_DISCOUNT &&
      discount >= MIN_DISCOUNT_FOR_GOOD_RATING
    ) {
      return true;
    }

    return false;
  });

  logger.info(
    `🔍 Filtered to ${qualityDeals.length} quality deals (from ${enriched.length} enriched)`,
    {
      qualityCount: qualityDeals.length,
      totalEnriched: enriched.length,
      minDiscount: MIN_DISCOUNT_PERCENT,
    },
  );

  if (qualityDeals.length === 0) {
    logger.info('📭 No quality deals to post this time');
    return 0;
  }

  const sorted = qualityDeals
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals);

  logger.info(`✅ Posting top ${sorted.length} quality deals`, {
    sortedCount: sorted.length,
  });

  let posted = 0;

  for (const entry of sorted) {
    const { deal, eurPrice, historical } = entry;
    const platform = storeNames[deal.storeID] ?? 'Unknown';
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
      if (err instanceof Error && err.message.includes('duplicate key')) {
        return;
      }
      throw err;
    });

    posted++;
  }

  return posted;
}
