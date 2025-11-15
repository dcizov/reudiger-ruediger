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
import type { ItadDeal } from '../schemas/itadDeals.js';
import type { SteamGameMetadata } from '../schemas/steamStore.js';
import { getBotConfig } from '../util/botConfig.js';
import {
  filterValidGameDeals,
  generateDealId,
  getItadDeals,
} from '../util/itadDeals.js';
import type { ItadGameOverview } from '../util/itadPrice.js';
import { getItadGameOverview } from '../util/itadPrice.js';
import { logger } from '../util/logger.js';
import { addPostedDeal, getPostedDealIDs } from '../util/postedDeals.js';
import { sanitizeDiscordText } from '../util/sanitizeText.js';
import { resolveSteamAppId } from '../util/steamAppIdResolver.js';
import { batchGetSteamGameMetadata } from '../util/steamStoreApi.js';

const MIN_DISCOUNT_PERCENT = 70;
const MIN_RATING_FOR_LOWER_DISCOUNT = 7.0;
const MIN_DISCOUNT_FOR_GOOD_RATING = 50;

interface EnrichedDeal {
  gameId: string;
  deal: ItadDeal;
  gameData: ItadGameOverview;
  steamMetadata: SteamGameMetadata | null; // Steam-specific metadata (Metacritic, reviews)
  score: number;
  discount: number;
  rating: number;
}

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

  const apiKey = env.ITAD_API_KEY;
  if (!apiKey) {
    logger.warn('⚠️ No ITAD API key configured');
    return 0;
  }

  // Fetch deals from ITAD /deals/v2 endpoint (1 API call instead of 101!)
  const rawDeals = await getItadDeals(apiKey, 'DE', 100, '-cut');
  logger.info(`📊 Fetched ${rawDeals.length} deals from ITAD`, {
    rawDealsCount: rawDeals.length,
  });

  if (rawDeals.length === 0) return 0;

  // Filter out non-game items (educational bundles, certification courses, etc.)
  const gameDeals = filterValidGameDeals(rawDeals);
  logger.info(
    `🎮 Filtered to ${gameDeals.length} valid game deals (removed ${rawDeals.length - gameDeals.length} non-game items)`,
    {
      validGameCount: gameDeals.length,
      removedCount: rawDeals.length - gameDeals.length,
    },
  );

  if (gameDeals.length === 0) {
    logger.info('📭 No valid game deals found after filtering');
    return 0;
  }

  const postedIDs = new Set(await getPostedDealIDs());
  logger.info(`🗄️ Found ${postedIDs.size} previously posted deals in DB`, {
    postedIDsCount: postedIDs.size,
  });

  // Filter out already posted deals using generated deal IDs
  const newDeals = gameDeals.filter((deal: ItadDeal) => {
    const dealId = generateDealId(deal);
    return !postedIDs.has(dealId);
  });
  logger.info(
    `🆕 Filtered to ${newDeals.length} new deals (not posted before)`,
    { newDealsCount: newDeals.length },
  );

  if (newDeals.length === 0) return 0;

  const channel = await client.channels.fetch(config.dealsChannelId);
  if (!isSendableChannel(channel)) {
    logger.warn('⚠️ Deals channel is not a valid text channel');
    return 0;
  }

  // Extract game IDs directly from ITAD deals (no lookup needed!)
  const gameIDs = newDeals.map((deal: ItadDeal) => deal.id);

  // Fetch comprehensive game data in one batch call
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

  // Step 4: Selective Steam enrichment (only for Steam games)
  // Resolve Steam App IDs for all deals
  const steamAppIdPromises = newDeals.map(async (deal: ItadDeal) => ({
    itadGameId: deal.id,
    steamAppId: await resolveSteamAppId(deal.id, deal.title),
  }));

  const steamAppIdResults = await Promise.all(steamAppIdPromises);
  const steamAppIds = steamAppIdResults
    .filter((result) => result.steamAppId !== null)
    .map((result) => result.steamAppId!);

  logger.info(
    `🎮 Resolved ${steamAppIds.length}/${newDeals.length} Steam App IDs`,
    {
      steamGames: steamAppIds.length,
      totalDeals: newDeals.length,
    },
  );

  // Batch fetch Steam metadata for all resolved Steam games
  const steamMetadataMap =
    steamAppIds.length > 0
      ? await batchGetSteamGameMetadata(steamAppIds)
      : new Map<number, SteamGameMetadata>();

  // Create lookup map: ITAD game ID → Steam metadata
  const itadToSteamMetadata = new Map<string, SteamGameMetadata>();
  for (const result of steamAppIdResults) {
    if (result.steamAppId !== null) {
      const metadata = steamMetadataMap.get(result.steamAppId);
      if (metadata) {
        itadToSteamMetadata.set(result.itadGameId, metadata);
      }
    }
  }

  logger.info(
    `📊 Enriched ${itadToSteamMetadata.size} deals with Steam metadata`,
    {
      enrichedCount: itadToSteamMetadata.size,
      withMetacritic: Array.from(itadToSteamMetadata.values()).filter(
        (m) => m.metacriticScore !== null,
      ).length,
      withReviews: Array.from(itadToSteamMetadata.values()).filter(
        (m) => m.totalReviews !== null,
      ).length,
    },
  );

  const enriched = newDeals
    .map((deal: ItadDeal): EnrichedDeal | null => {
      const gameData = gameOverviews[deal.id];
      if (!gameData) return null;

      const steamMetadata = itadToSteamMetadata.get(deal.id) ?? null;
      const discount = deal.deal.cut; // Discount percentage from ITAD (0-100)
      const price = gameData.currentPrice;

      // Rating calculation: Use Metacritic if available, otherwise fallback to heuristics
      let rating: number;
      if (
        steamMetadata?.metacriticScore !== null &&
        steamMetadata?.metacriticScore !== undefined
      ) {
        // Use Metacritic score (0-100) converted to 0-10 scale
        rating = steamMetadata.metacriticScore / 10;
      } else {
        // Fallback: heuristic rating based on discount and historical low
        rating =
          deal.deal.flag === 'H'
            ? 8.0 // Historical low gets good rating
            : deal.deal.cut >= 75
              ? 7.0 // Very high discount gets decent rating
              : 5.0; // Default rating
      }

      // Score calculation: discount * 2 + rating - price * 0.3
      let score = discount * 2 + rating - price * 0.3;

      // Bonus: Add 2 points for highly-rated games with lots of positive reviews
      if (
        steamMetadata?.totalReviews !== null &&
        steamMetadata?.totalReviews !== undefined &&
        steamMetadata.totalReviews > 1000 &&
        steamMetadata.metacriticScore !== null &&
        steamMetadata.metacriticScore !== undefined &&
        steamMetadata.metacriticScore >= 90
      ) {
        score += 2;
      }

      return {
        gameId: deal.id,
        deal,
        gameData,
        steamMetadata,
        score,
        discount,
        rating,
      };
    })
    .filter((item): item is EnrichedDeal => item !== null);

  const qualityDeals = enriched.filter((item: EnrichedDeal) => {
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
    .sort((a: EnrichedDeal, b: EnrichedDeal) => b.score - a.score)
    .slice(0, maxDeals);

  logger.info(`✅ Posting top ${sorted.length} quality deals`, {
    sortedCount: sorted.length,
  });

  let posted = 0;

  for (const entry of sorted) {
    const { deal, gameData, steamMetadata, rating } = entry;
    // Use best available image: Steam header > ITAD banners > boxart
    const imageUrl =
      steamMetadata?.headerImage ??
      deal.assets.banner600 ??
      deal.assets.banner400 ??
      deal.assets.banner300 ??
      deal.assets.boxart ??
      '';

    const savings = `${deal.deal.cut}%`;
    const dealId = generateDealId(deal);

    // Add platform/DRM badges
    const platformBadges = deal.deal.platforms
      .map((p: { id: number; name: string }) => p.name)
      .join(' • ');
    const drmInfo =
      deal.deal.drm
        .map((d: { id: number; name: string }) => d.name)
        .join(', ') || 'DRM-Free';

    // Build embed fields dynamically
    const embedFields = [
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
        value: sanitizeDiscordText(deal.deal.shop.name, 100),
        inline: true,
      },
    ];

    // Rating field: Show Metacritic if available, otherwise fallback rating
    if (
      steamMetadata?.metacriticScore !== null &&
      steamMetadata?.metacriticScore !== undefined
    ) {
      embedFields.push({
        name: '⭐ Metacritic',
        value: `${steamMetadata.metacriticScore}/100`,
        inline: true,
      });
    } else {
      embedFields.push({
        name: '⭐ Rating',
        value: `${rating.toFixed(1)}/10`,
        inline: true,
      });
    }

    embedFields.push({
      name: '🔧 DRM',
      value: sanitizeDiscordText(drmInfo, 100),
      inline: true,
    });

    // Reviews field: Show Steam review count if available
    if (
      steamMetadata?.totalReviews !== null &&
      steamMetadata?.totalReviews !== undefined &&
      steamMetadata.totalReviews > 0
    ) {
      // Format review count with thousands separator
      const reviewCount = steamMetadata.totalReviews.toLocaleString('en-US');
      embedFields.push({
        name: '👍 Reviews',
        value: `${reviewCount} total`,
        inline: true,
      });
    }

    // Developer/Publisher field: Show if available from Steam
    if (steamMetadata && steamMetadata.developers.length > 0) {
      const devInfo =
        steamMetadata.developers.length === 1 &&
        steamMetadata.publishers.length === 1 &&
        steamMetadata.developers[0] === steamMetadata.publishers[0]
          ? steamMetadata.developers[0] // Same dev/pub, show once
          : steamMetadata.developers.join(', '); // Show devs only
      embedFields.push({
        name: '🎨 Developer',
        value: sanitizeDiscordText(devInfo ?? 'Unknown', 100),
        inline: true,
      });
    }

    // Genre field: Show top 3 genres if available from Steam
    if (steamMetadata && steamMetadata.genres.length > 0) {
      const genreList = steamMetadata.genres.slice(0, 3).join(', ');
      embedFields.push({
        name: '🎮 Genre',
        value: sanitizeDiscordText(genreList, 100),
        inline: true,
      });
    }

    embedFields.push(
      {
        name: '💻 Platforms',
        value: sanitizeDiscordText(platformBadges || 'Unknown', 100),
        inline: false,
      },
      {
        name: '📉 Historical Low',
        value: `€${gameData.historicalLow.toFixed(2)} • ${
          gameData.isLowest ? '**New All-Time Low!** 🔥' : 'Not lowest'
        }`,
        inline: true,
      },
    );

    // Free-to-play badge
    if (steamMetadata?.isFree) {
      embedFields.push({
        name: '🆓 Free to Play',
        value: 'This game is free!',
        inline: true,
      });
    }

    // Coming soon badge
    if (steamMetadata?.comingSoon) {
      embedFields.push({
        name: '📅 Coming Soon',
        value: 'Not yet released',
        inline: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(sanitizeDiscordText(`🎮 ${deal.title}`))
      .setURL(deal.deal.url)
      .setImage(imageUrl)
      .setColor(gameData.isLowest ? 0xff4500 : 0x00ae86) // Orange for all-time low, green otherwise
      .addFields(...embedFields)
      .setFooter({
        text: 'Prices via IsThereAnyDeal.com • EU Region',
        iconURL: 'https://isthereanydeal.com/assets/favicon.png',
      })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });

    await addPostedDeal({
      dealId,
      messageId: message.id,
      title: deal.title,
      store: deal.deal.shop.name,
      platform: platformBadges,
      salePrice: gameData.currentPrice.toFixed(2),
      normalPrice: gameData.regularPrice.toFixed(2),
      savings,
      dealRating: rating.toFixed(1),
      imageUrl,
      url: deal.deal.url,
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
