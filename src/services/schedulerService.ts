import type { Client } from "discord.js";
import cron, { type ScheduledTask } from "node-cron";
import { getBotConfig } from "../utils/botConfig";
import { cleanupExpiredDeals } from "./cleanupDeals";
import { postNewDeals } from "./postNewDeals";

let currentTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
const DEFAULT_CRON = "*/10 * * * *";
const CLEANUP_CRON = "0 * * * *"; // Every hour

export async function startDealScheduler(client: Client) {
  // Stop existing tasks
  if (currentTask) {
    await currentTask.stop();
    currentTask = null;
  }
  if (cleanupTask) {
    await cleanupTask.stop();
    cleanupTask = null;
  }

  const config = await getBotConfig();
  const schedule = config.schedule || DEFAULT_CRON;

  // Schedule posting new deals
  currentTask = cron.schedule(schedule, async () => {
    try {
      const posted = await postNewDeals(client, 5);
      if (posted > 0) {
        console.log(`Posted ${posted} new deal(s)!`);
      }
    } catch (err) {
      console.error("Error posting scheduled deals:", err);
    }
  });

  // Schedule cleanup of expired deals
  cleanupTask = cron.schedule(CLEANUP_CRON, async () => {
    try {
      const removed = await cleanupExpiredDeals(client);
      if (removed > 0) {
        console.log(`Cleaned up ${removed} expired deal(s)!`);
      }
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  });

  console.log(`Scheduler started with cron: ${schedule}`);
  console.log(`Cleanup scheduled every hour`);
}

export async function restartDealScheduler(client: Client) {
  await startDealScheduler(client);
}
