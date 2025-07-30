import type { Client } from "discord.js";
import cron, { type ScheduledTask } from "node-cron";
import { cleanupExpiredDeals } from "./cleanupDeals";
import { postNewDeals } from "./postNewDeals";
import { checkSubscriptionsAndNotify } from "./subscriptionChecker";

let currentTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
let subscriptionTask: ScheduledTask | null = null;

export async function startDealScheduler(client: Client): Promise<void> {
  if (currentTask) currentTask.stop();
  if (cleanupTask) cleanupTask.stop();
  if (subscriptionTask) subscriptionTask.stop();

  currentTask = cron.schedule("*/30 * * * *", async () => {
    const posted = await postNewDeals(client, 5);
    if (posted > 0) console.log(`Posted ${posted} new deal(s).`);
  });

  cleanupTask = cron.schedule("0 * * * *", async () => {
    const removed = await cleanupExpiredDeals(client);
    if (removed > 0) console.log(`Cleaned up ${removed} expired deals.`);
  });

  subscriptionTask = cron.schedule("*/15 * * * *", async () => {
    const notified = await checkSubscriptionsAndNotify(client);
    if (notified > 0)
      console.log(`🔔 Notified ${notified} subscribed user(s).`);
  });

  console.log(
    "Scheduler started: Deals every 30m, cleanup hourly, subscription check every 15m."
  );
}
