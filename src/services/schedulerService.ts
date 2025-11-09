import type { Client } from 'discord.js';
import cron, { type ScheduledTask } from 'node-cron';

import { logger } from '../utils/logger';
import { cleanupExpiredDeals } from './cleanupDeals';
import { postNewDeals } from './postNewDeals';
import { checkSubscriptionsAndNotify } from './subscriptionChecker';

let currentTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
let subscriptionTask: ScheduledTask | null = null;

export function startDealScheduler(client: Client): void {
  // Fix: stop() returns a promise in node-cron, need to handle it
  if (currentTask) void currentTask.stop();
  if (cleanupTask) void cleanupTask.stop();
  if (subscriptionTask) void subscriptionTask.stop();

  currentTask = cron.schedule('*/30 * * * *', () => {
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

  logger.info(
    'Scheduler started: Deals every 30m, cleanup hourly, subscription check every 15m.',
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
