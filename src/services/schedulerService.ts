import type { Client } from 'discord.js';
import cron, { type ScheduledTask } from 'node-cron';

import { getBotConfig } from '../utils/botConfig';
import { logger } from '../utils/logger';
import { cleanupExpiredDeals } from './cleanupDeals';
import { checkGameNews, cleanupOldPostedNews } from './newsService';
import { postNewDeals } from './postNewDeals';
import { checkSubscriptionsAndNotify } from './subscriptionChecker';

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

  // ✅ Deals scheduler
  currentTask = cron.schedule(dealSchedule, () => {
    void (async () => {
      const posted = await postNewDeals(client, 5);
      if (posted > 0) logger.info(`Posted ${posted} new deal(s).`, { posted });
    })();
  });

  // ✅ Cleanup expired deals - hourly
  cleanupTask = cron.schedule('0 * * * *', () => {
    void (async () => {
      const removed = await cleanupExpiredDeals(client);
      if (removed > 0)
        logger.info(`Cleaned up ${removed} expired deals.`, { removed });
    })();
  });

  // ✅ Subscription checks - every 15 minutes
  subscriptionTask = cron.schedule('*/15 * * * *', () => {
    void (async () => {
      const notified = await checkSubscriptionsAndNotify(client);
      if (notified > 0)
        logger.info(`🔔 Notified ${notified} subscribed user(s).`, {
          notified,
        });
    })();
  });

  // ✅ NEWS: Check every 15 minutes (more frequent for timely news)
  newsTask = cron.schedule('*/15 * * * *', () => {
    void (async () => {
      const posted = await checkGameNews(client);
      if (posted > 0)
        logger.info(`📰 Posted ${posted} news item(s).`, { posted });
    })();
  });

  // ✅ NEWS: Cleanup old posted news daily at 3 AM
  newsCleanupTask = cron.schedule('0 3 * * *', () => {
    void (async () => {
      const cleaned = await cleanupOldPostedNews();
      if (cleaned > 0)
        logger.info(`🗑️ Cleaned up ${cleaned} old news entries.`, { cleaned });
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
