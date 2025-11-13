import { Client } from 'discord.js';
import { eq, inArray } from 'drizzle-orm';

import { env } from '../config.js';
import { db } from '../db/index.js';
import { subscriptions, userSettings } from '../db/schema.js';
import { getItadGameOverview } from '../util/itadPrice.js';
import { logger } from '../util/logger.js';

export async function checkSubscriptionsAndNotify(
  client: Client,
): Promise<number> {
  const apiKey = env.ITAD_API_KEY;
  if (!apiKey) {
    console.error('❌ ITAD_API_KEY not set.');
    return 0;
  }

  const allSubs = await db.select().from(subscriptions);
  if (!allSubs.length) return 0;

  const userIds = [...new Set(allSubs.map((s) => s.userId))];
  const allSettings = await db.query.userSettings.findMany({
    where: inArray(userSettings.userId, userIds),
  });
  const settingsMap = new Map(
    allSettings.map((s) => [s.userId, s.notificationsEnabled]),
  );

  const groupedByGame = new Map<string, (typeof allSubs)[number][]>();

  for (const sub of allSubs) {
    if (!groupedByGame.has(sub.gameId)) {
      groupedByGame.set(sub.gameId, []);
    }
    groupedByGame.get(sub.gameId)!.push(sub);
  }

  const notifiedUserIds: number[] = [];

  // Batch all game IDs into a single API call to avoid N+1 query pattern
  const allGameIds = Array.from(groupedByGame.keys());
  const gameOverviews = await getItadGameOverview(apiKey, allGameIds);

  for (const [gameId, subsForGame] of groupedByGame.entries()) {
    const gameData = gameOverviews[gameId];
    if (!gameData) {
      logger.warn('No price data for subscribed game', { gameId });
      continue;
    }

    const currentPriceInCents = Math.round(gameData.currentPrice * 100);

    for (const sub of subsForGame) {
      const notificationsEnabled = settingsMap.get(sub.userId) ?? true;
      if (!notificationsEnabled) continue;

      const storedPrice = sub.currentPrice ?? currentPriceInCents;
      const threshold = sub.targetPrice;

      const shouldNotify =
        threshold != null
          ? currentPriceInCents <= threshold
          : currentPriceInCents < storedPrice;

      if (!shouldNotify) {
        if (sub.notified) {
          await db
            .update(subscriptions)
            .set({ notified: false })
            .where(eq(subscriptions.id, sub.id));
        }
        continue;
      }

      const user = await client.users.fetch(sub.userId).catch(() => null);
      if (!user) continue;

      const savings = (
        (1 - currentPriceInCents / (sub.historicalLow ?? currentPriceInCents)) *
        100
      ).toFixed(0);

      const dmContent = `🔔 **Price Drop for _${sub.title}_!**

💰 New Price: €${gameData.currentPrice.toFixed(2)}${gameData.cut > 0 ? ` (${gameData.cut}% off)` : ''}
💸 Previous: €${(storedPrice / 100).toFixed(2)}
🎯 Target: ${sub.targetPrice ? `€${(sub.targetPrice / 100).toFixed(2)}` : 'Any drop'}
📉 Savings vs historical: ${savings}%
🏪 Store: ${gameData.shop}
${gameData.isLowest ? '🔥 **NEW ALL-TIME LOW!**\n' : ''}🔗 ${gameData.url}`;

      // Only update database if DM was successfully sent
      try {
        await user.send({ content: dmContent });

        // Mark as notified only if DM succeeded
        await db
          .update(subscriptions)
          .set({
            currentPrice: currentPriceInCents,
            notified: true,
          })
          .where(eq(subscriptions.id, sub.id));

        notifiedUserIds.push(sub.id);
        logger.info('Notified user about price drop', {
          userId: sub.userId,
          gameId: sub.gameId,
          gameTitle: sub.title,
          newPrice: currentPriceInCents,
        });
      } catch (error) {
        // User has DMs disabled or bot is blocked
        logger.debug('Could not send DM to user', {
          userId: sub.userId,
          gameId: sub.gameId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't mark as notified - retry next time
      }
    }
  }

  return notifiedUserIds.length;
}
