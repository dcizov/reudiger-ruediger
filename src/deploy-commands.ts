import { REST, Routes } from 'discord.js';

import { commands } from './commands';
import { env } from './config';
import { logger } from './utils/logger';

const commandsData = Object.values(commands).map((command) =>
  command.data.toJSON(),
);

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    logger.info('🚀 Started refreshing application (/) commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        env.DISCORD_CLIENT_ID,
        env.DISCORD_GUILD_ID,
      ),
      { body: commandsData },
    );

    logger.info('✅ Successfully reloaded application (/) commands!');
  } catch (err) {
    logger.error('❌ Error deploying commands:', { error: err });
    process.exit(1);
  }
}

deployCommands().catch((err: unknown) => {
  logger.error('Failed to deploy commands:', { error: err });
  process.exit(1);
});
