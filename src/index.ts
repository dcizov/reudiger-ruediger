import process from 'node:process';
import { URL } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';

import { env, isDev } from './config';
import { stopDealScheduler } from './services/schedulerService';
import { loadEvents } from './utils/loaders';
import { logger } from './utils/logger';
import { startWebhookServer } from './webhookServer';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const events = await loadEvents(new URL('events/', import.meta.url));

logger.info(`📦 Registering ${events.length} event handlers...`);

for (const event of events) {
  const eventHandler = async (...args: unknown[]) => {
    try {
      await event.execute(...(args as Parameters<typeof event.execute>));
    } catch (error) {
      logger.error(`Error executing event ${String(event.name)}:`, {
        error,
      });
    }
  };

  if (event.once) {
    client.once(event.name, (...args) => void eventHandler(...args));
  } else {
    client.on(event.name, (...args) => void eventHandler(...args));
  }
}

if (!env.DISCORD_TOKEN) {
  logger.error('❌ DISCORD_TOKEN is missing from config.');
  process.exit(1);
}

await client.login(env.DISCORD_TOKEN);

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received, shutting down gracefully...`);
  stopDealScheduler();
  await client.destroy();
  logger.info('✅ Bot shut down successfully');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

if (isDev || env.ENABLE_WEBHOOK_SERVER) {
  startWebhookServer();
}
