import { URL } from 'node:url';
import { REST, Routes } from 'discord.js';

import { env } from '../config.js';
import { loadCommands } from './loaders.js';
import { logger } from './logger.js';

/**
 * Deploys slash commands to Discord
 * @returns Promise that resolves when commands are deployed
 */
export async function deployCommands(): Promise<void> {
  const commands = await loadCommands(new URL('../commands/', import.meta.url));

  const commandsData = [...commands.values()].map((command) =>
    command.data.toJSON(),
  );

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  logger.info(
    `🚀 Started refreshing ${commandsData.length} application (/) commands...`,
  );

  await rest.put(
    Routes.applicationGuildCommands(
      env.DISCORD_CLIENT_ID,
      env.DISCORD_GUILD_ID,
    ),
    {
      body: commandsData,
    },
  );

  logger.info(
    `✅ Successfully reloaded ${commandsData.length} application (/) commands!`,
  );
  logger.info(`Commands: ${[...commands.keys()].join(', ')}`);
}
