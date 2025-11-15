import process from 'node:process';
import { URL } from 'node:url';
import { Client, Events, GatewayIntentBits } from 'discord.js';

import { env, isDev } from './config.js';
import { stopDealScheduler } from './services/schedulerService.js';
import { loadEvents } from './util/loaders.js';
import { logger } from './util/logger.js';
import { getSteamAppList } from './util/steamWebApi.js';
import { startWebhookServer } from './webhookServer.js';

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

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`✅ Ready! Logged in as ${readyClient.user.tag}`);
  void getSteamAppList()
    .then((apps) => {
      logger.info(`✅ Pre-loaded ${apps.length} Steam apps for autocomplete`);
    })
    .catch((error) => {
      logger.error('Failed to pre-load Steam app list:', error);
      logger.warn('⚠️ Steam game autocomplete will be slow until cache loads');
    });
});

// DISCORD_TOKEN is already validated by Zod in config.ts, no need to check again
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
