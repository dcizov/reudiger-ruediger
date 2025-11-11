import type { Client } from 'discord.js';
import cron, { type ScheduledTask } from 'node-cron';

import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';
import { cleanupExpiredDeals } from './cleanupDeals';
import { checkGameNews } from './newsService';
import { postNewDeals } from './postNewDeals';
import { checkSubscriptionsAndNotify } from './subscriptionChecker';

let currentTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
let subscriptionTask: ScheduledTask | null = null;
let newsTask: ScheduledTask | null = null;

export async function startDealScheduler(client: Client): Promise<void> {
  if (currentTask) void currentTask.stop();
  if (cleanupTask) void cleanupTask.stop();
  if (subscriptionTask) void subscriptionTask.stop();
  if (newsTask) void newsTask.stop();

  const config = await getBotConfig();
  const dealSchedule = config.schedule || '*/30 * * * *'; // Fallback to 30 mins

  currentTask = cron.schedule(dealSchedule, () => {
    void (async () => {
      const posted = await postNewDeals(client, 5);
      if (posted > 0) logger.info(`Posted ${posted} new deal(s).`, { posted });
    })();
  });

  cleanupTask = cron.schedule('0 * * * *', () => {
    void (async () => {
      const removed = await cleanupExpiredDeals(client);
      if (removed > 0)
        logger.info(`Cleaned up ${removed} expired deals.`, { removed });
    })();
  });

  subscriptionTask = cron.schedule('*/15 * * * *', () => {
    void (async () => {
      const notified = await checkSubscriptionsAndNotify(client);
      if (notified > 0)
        logger.info(`🔔 Notified ${notified} subscribed user(s).`, {
          notified,
        });
    })();
  });

  newsTask = cron.schedule('0 * * * *', () => {
    void (async () => {
      // Pass guild ID if available from client
      const posted = await checkGameNews(client);
      if (posted > 0)
        logger.info(`📰 Posted ${posted} news item(s).`, { posted });
    })();
  });

  logger.info(
    `Scheduler started: Deals on schedule '${dealSchedule}', cleanup hourly, subscription check every 15m.`,
  );
}

export function stopDealScheduler(): void {
  if (currentTask) {
    void currentTask.stop();
    currentTask = null;
  }
  if (cleanupTask) {
    void cleanupTask.stop();
    cleanupTask = null;
  }
  if (subscriptionTask) {
    void subscriptionTask.stop();
    subscriptionTask = null;
  }

  logger.info('✅ All schedulers stopped gracefully');
}
