import { Client } from 'discord.js';
import { eq, inArray } from 'drizzle-orm';

import { env } from '../config';
import { db } from '../db/index';
import { subscriptions, userSettings } from '../db/schema';
import { getItadEurPrices } from '../utils/itadPrice';

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

  // Fix: Fetch all user settings at once to avoid N+1 queries
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

  for (const [gameId, subsForGame] of groupedByGame.entries()) {
    const eurPrices = await getItadEurPrices(apiKey, [gameId]);
    const priceInfo = eurPrices[gameId];
    if (!priceInfo) continue;

    const currentPriceInCents = Math.round(priceInfo.price_new * 100);

    for (const sub of subsForGame) {
      // Fix: Use Map lookup instead of database query
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

💰 New Price: €${priceInfo.price_new.toFixed(2)}
💸 Previous: €${(storedPrice / 100).toFixed(2)}
🎯 Target: ${sub.targetPrice ? `€${(sub.targetPrice / 100).toFixed(2)}` : 'Any drop'}
📉 Savings vs historical: ${savings}%
🏪 Store: ${priceInfo.shop}
🔗 ${priceInfo.url}`;

      await user.send({ content: dmContent }).catch(() => null);

      await db
        .update(subscriptions)
        .set({
          currentPrice: currentPriceInCents,
          notified: true,
        })
        .where(eq(subscriptions.id, sub.id));

      notifiedUserIds.push(sub.id);
    }
  }

  return notifiedUserIds.length;
}
