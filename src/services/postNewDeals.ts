import {
  EmbedBuilder,
  type Channel,
  type Client,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
} from 'discord.js';

import { env } from '../config.js';
import { getBotConfig } from '../util/botConfig.js';
import { getDeals } from '../util/cheapshark.js';
import { getItadGameId, getItadGameOverview } from '../util/itadPrice.js';
import { logger } from '../util/logger.js';
import { addPostedDeal, getPostedDealIDs } from '../util/postedDeals.js';
import { sanitizeDiscordText } from '../util/sanitizeText.js';
import { storeNames } from '../util/stores.js';

const MIN_DISCOUNT_PERCENT = 70;
const MIN_RATING_FOR_LOWER_DISCOUNT = 7.0;
const MIN_DISCOUNT_FOR_GOOD_RATING = 50;

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

  const gameOverviews = await getItadGameOverview(
    apiKey,
    gameIDs,
    'DE',
    client,
  );
  logger.info(
    `💶 Got complete data for ${Object.keys(gameOverviews).length} games`,
    { dataCount: Object.keys(gameOverviews).length },
  );

  const enriched = newDeals
    .map((deal) => {
      const gameId = titleToGameId.get(deal.dealID);
      if (!gameId) return null;

      const gameData = gameOverviews[gameId];
      if (!gameData) return null;

      const discount = parseFloat(deal.savings);
      const rating = parseFloat(deal.dealRating ?? '0');
      const price = gameData.currentPrice;

      const score = discount * 2 + rating - price * 0.3;

      return {
        gameId,
        deal,
        gameData,
        score,
        discount,
        rating,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const qualityDeals = enriched.filter((item) => {
    const { discount, rating, gameData } = item;

    if (gameData.isLowest && discount >= 50) {
      return true;
    }

    if (discount >= MIN_DISCOUNT_PERCENT) {
      return true;
    }

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
    const { deal, gameData } = entry;
    const platform = storeNames[deal.storeID] ?? 'Unknown';
    const imageUrl = deal.steamAppID
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
      : deal.thumb;

    const savings = `${parseFloat(deal.savings).toFixed(0)}%`;

    const embed = new EmbedBuilder()
      .setTitle(sanitizeDiscordText(`🎮 ${deal.title}`))
      .setURL(gameData.url)
      .setImage(imageUrl)
      .setColor(0x00ae86)
      .addFields(
        {
          name: '💰 Sale Price',
          value: `€${gameData.currentPrice.toFixed(2)}`,
          inline: true,
        },
        {
          name: '💸 Normal Price',
          value: `~~€${gameData.regularPrice.toFixed(2)}~~`,
          inline: true,
        },
        { name: '📉 Discount', value: `-${savings}`, inline: true },
        {
          name: '🏪 Store',
          value: sanitizeDiscordText(gameData.shop, 100),
          inline: true,
        },
        {
          name: '⭐ Rating',
          value: deal.dealRating
            ? `${parseFloat(deal.dealRating).toFixed(1)}/10`
            : 'N/A',
          inline: true,
        },
        {
          name: '🔗 Links',
          value: `[🛒 Deal](${gameData.url})${deal.steamAppID ? ` • [🎮 Steam](https://store.steampowered.com/app/${deal.steamAppID})` : ''}`,
          inline: false,
        },
        {
          name: '📉 Historical Low',
          value: `€${gameData.historicalLow.toFixed(2)} • ${
            gameData.isLowest ? '**New All-Time Low!** 🔥' : 'Not lowest'
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
      store: gameData.shop,
      platform,
      salePrice: gameData.currentPrice.toFixed(2),
      normalPrice: gameData.regularPrice.toFixed(2),
      savings,
      dealRating: deal.dealRating,
      imageUrl,
      url: gameData.url,
      postedAt: new Date(),
      postedPrice: gameData.currentPrice,
      lowestEver: gameData.isLowest,
      historicalLow: gameData.historicalLow,
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
