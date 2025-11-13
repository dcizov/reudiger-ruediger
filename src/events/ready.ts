import { ActivityType, Events, type Client } from 'discord.js';

import { startDealScheduler } from '../services/schedulerService.js';
import type { Event } from './index.js';
import { initializeDiscordLogger, logger } from '../util/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client<true>) {
    logger.info(`✅ Discord bot is ready! Logged in as ${client.user.tag}`);

    client.user.setPresence({
      activities: [
        {
          name: '/help for commands',
          type: ActivityType.Playing,
        },
      ],
      status: 'online',
    });

    logger.info('🎮 Bot status set: Playing /help for commands');

    initializeDiscordLogger(client);
    await startDealScheduler(client);
  },
} satisfies Event<Events.ClientReady>;
