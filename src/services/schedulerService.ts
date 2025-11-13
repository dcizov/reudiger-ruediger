import type { Client } from 'discord.js';
import cron, { type ScheduledTask } from 'node-cron';

import { getBotConfig } from '../util/botConfig.js';
import { logger } from '../util/logger.js';
import { cleanupExpiredDeals } from './cleanupDeals.js';
import {
  checkGameNews,
  cleanupExpiredRssCache,
  cleanupOldPostedNews,
} from './newsService.js';
import { postNewDeals } from './postNewDeals.js';
import { checkSubscriptionsAndNotify } from './subscriptionChecker.js';

let currentTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
let subscriptionTask: ScheduledTask | null = null;
let newsTask: ScheduledTask | null = null;
let newsCleanupTask: ScheduledTask | null = null;

export async function startDealScheduler(client: Client): Promise<void> {
  if (currentTask) void currentTask.stop();
  if (cleanupTask) void cleanupTask.stop();
  if (subscriptionTask) void subscriptionTask.stop();
  if (newsTask) void newsTask.stop();
  if (newsCleanupTask) void newsCleanupTask.stop();

  const config = await getBotConfig();
  const dealSchedule = config.schedule || '*/30 * * * *';

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

  newsTask = cron.schedule('*/15 * * * *', () => {
    void (async () => {
      logger.debug('🔍 Running scheduled news check...');
      const posted = await checkGameNews(client);
      if (posted > 0) {
        logger.info(`📰 Posted ${posted} news item(s).`, { posted });
      }
    })();
  });

  newsCleanupTask = cron.schedule('0 3 * * *', () => {
    void (async () => {
      const cleaned = await cleanupOldPostedNews();
      if (cleaned > 0)
        logger.info(`🗑️ Cleaned up ${cleaned} old news entries.`, { cleaned });

      // Clean up expired RSS cache entries to prevent memory leaks
      cleanupExpiredRssCache();
    })();
  });

  logger.info(
    `Scheduler started: Deals on schedule '${dealSchedule}', cleanup hourly, subscription check every 15m, news check every 15m.`,
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
  if (newsTask) {
    void newsTask.stop();
    newsTask = null;
  }
  if (newsCleanupTask) {
    void newsCleanupTask.stop();
    newsCleanupTask = null;
  }

  logger.info('✅ All schedulers stopped gracefully');
}
