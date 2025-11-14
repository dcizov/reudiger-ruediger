import { Client } from 'discord.js';
import { eq, inArray } from 'drizzle-orm';

import { env } from '../config.js';
import { db } from '../db/index.js';
import { steamWishlists, userSettings } from '../db/schema.js';
import { logger } from '../util/logger.js';
import { getSteamStoreDetails } from '../util/steamWebApi.js';

/**
 * Check all Steam wishlists for price drops and notify users
 * Runs periodically via scheduler
 *
 * @param client - Discord client for sending DMs
 * @returns Number of users notified
 */
export async function checkSteamWishlistsAndNotify(
  client: Client,
): Promise<number> {
  const apiKey = env.STEAM_API_KEY;
  if (!apiKey) {
    logger.warn('STEAM_API_KEY not set, skipping Steam wishlist checks');
    return 0;
  }

  // Fetch all wishlist items that haven't been notified yet
  const allWishlistItems = await db
    .select()
    .from(steamWishlists)
    .where(eq(steamWishlists.notified, false));

  if (allWishlistItems.length === 0) {
    logger.debug('No unnotified wishlist items to check');
    return 0;
  }

  logger.info('Checking Steam wishlist prices', {
    totalItems: allWishlistItems.length,
  });

  // Fetch user settings for notification preferences
  const userIds = [...new Set(allWishlistItems.map((item) => item.userId))];
  const allSettings = await db.query.userSettings.findMany({
    where: inArray(userSettings.userId, userIds),
  });
  const settingsMap = new Map(
    allSettings.map((s) => [s.userId, s.notificationsEnabled]),
  );

  let notifiedCount = 0;

  // Process each wishlist item
  for (const item of allWishlistItems) {
    // Check if user has notifications enabled
    const notificationsEnabled = settingsMap.get(item.userId) ?? true;
    if (!notificationsEnabled) {
      logger.debug('User has notifications disabled', {
        userId: item.userId,
        gameName: item.gameName,
      });
      continue;
    }

    try {
      // Fetch current price from Steam Store API
      const gameDetails = await getSteamStoreDetails(item.steamAppId);

      if (!gameDetails?.data) {
        logger.warn('Failed to fetch Steam game details', {
          appId: item.steamAppId,
          gameName: item.gameName,
        });
        continue;
      }

      const game = gameDetails.data;

      // Get current price in cents
      const currentPriceCents = game.price_overview
        ? game.price_overview.final
        : 0;

      // Free games (currentPriceCents === 0) - only notify if wasn't free before
      if (currentPriceCents === 0) {
        if (game.is_free && item.addedPrice === 0) {
          // Was free, still free - skip
          continue;
        }

        // Game went free! Always notify
        const dmContent = `🎉 **${item.gameName} is now FREE!**

🎮 This game on your wishlist is now **Free to Play**!
${item.addedPrice ? `💰 Was: €${(item.addedPrice / 100).toFixed(2)}` : ''}

🔗 Get it now: https://store.steampowered.com/app/${item.steamAppId}`;

        await sendNotificationAndUpdate(
          client,
          item.userId,
          item.id,
          currentPriceCents,
          dmContent,
        );
        notifiedCount++;
        continue;
      }

      // Paid game - check if price meets criteria
      const addedPrice = item.addedPrice ?? currentPriceCents;
      const targetPrice = item.targetPrice;

      // Determine if we should notify
      let shouldNotify = false;
      let notifyReason = '';

      if (targetPrice !== null) {
        // User set a target price - notify only if price drops below it
        if (currentPriceCents <= targetPrice) {
          shouldNotify = true;
          notifyReason = 'below_target';
        }
      } else {
        // No target price - notify on ANY price drop
        if (currentPriceCents < addedPrice) {
          shouldNotify = true;
          notifyReason = 'any_drop';
        }
      }

      if (!shouldNotify) {
        logger.debug('Price does not meet notification criteria', {
          gameName: item.gameName,
          currentPrice: currentPriceCents,
          targetPrice: targetPrice,
          addedPrice: addedPrice,
        });
        continue;
      }

      // Build notification message
      const priceInfo = game.price_overview!; // Safe: We checked currentPriceCents > 0
      const currentPriceEur = (currentPriceCents / 100).toFixed(2);
      const discountText =
        priceInfo.discount_percent > 0
          ? ` (-${priceInfo.discount_percent}% off!)`
          : '';

      let dmContent = `🔔 **Price Drop: ${item.gameName}**

💰 **Now: €${currentPriceEur}**${discountText}`;

      if (targetPrice !== null) {
        dmContent += `\n🎯 Target: €${(targetPrice / 100).toFixed(2)} ✅`;
      }

      if (addedPrice && addedPrice > currentPriceCents) {
        const savings = addedPrice - currentPriceCents;
        const savingsPercent = ((savings / addedPrice) * 100).toFixed(0);
        dmContent += `\n💸 Save: €${(savings / 100).toFixed(2)} (${savingsPercent}% off)`;
      }

      if (priceInfo.discount_percent > 0) {
        dmContent += `\n📊 Regular Price: ${priceInfo.initial_formatted}`;
      }

      dmContent += `\n\n🔗 Buy now: https://store.steampowered.com/app/${item.steamAppId}`;

      // Send notification and update database
      await sendNotificationAndUpdate(
        client,
        item.userId,
        item.id,
        currentPriceCents,
        dmContent,
      );
      notifiedCount++;

      logger.info('Notified user about Steam price drop', {
        userId: item.userId,
        gameName: item.gameName,
        currentPrice: currentPriceCents,
        reason: notifyReason,
      });
    } catch (error) {
      logger.error('Error checking Steam wishlist item', {
        error,
        userId: item.userId,
        appId: item.steamAppId,
        gameName: item.gameName,
      });
      // Continue with next item
    }
  }

  if (notifiedCount > 0) {
    logger.info('Steam wishlist check complete', {
      totalChecked: allWishlistItems.length,
      notificationsSent: notifiedCount,
    });
  }

  return notifiedCount;
}

/**
 * Helper function to send DM notification and update database
 * Only updates database if DM was successfully sent
 */
async function sendNotificationAndUpdate(
  client: Client,
  userId: string,
  wishlistItemId: number,
  currentPrice: number,
  dmContent: string,
): Promise<void> {
  try {
    const user = await client.users.fetch(userId).catch(() => null);

    if (!user) {
      logger.warn('Could not fetch Discord user for notification', { userId });
      return;
    }

    // Send DM
    await user.send({ content: dmContent });

    // Only mark as notified if DM succeeded
    await db
      .update(steamWishlists)
      .set({
        notified: true,
        addedPrice: currentPrice, // Update to current price for future comparisons
      })
      .where(eq(steamWishlists.id, wishlistItemId));

    logger.debug('Successfully sent Steam wishlist notification', {
      userId,
      wishlistItemId,
    });
  } catch (error) {
    // User has DMs disabled or bot is blocked
    logger.debug('Could not send DM to user for Steam wishlist', {
      userId,
      wishlistItemId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't mark as notified - retry next time
  }
}
