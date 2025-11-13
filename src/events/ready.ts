import { ActivityType, Events, type Client } from 'discord.js';

import { startDealScheduler } from '../services/schedulerService';
import type { Event } from '../types/event';
import { initializeDiscordLogger, logger } from '../utils/logger';

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
