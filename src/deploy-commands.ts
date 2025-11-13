import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';

import { env } from './config';
import { loadCommands } from './utils/loaders';
import { logger } from './utils/logger';

void (async () => {
  try {
    const commandsPath = path.join(__dirname, 'commands');
    const commands = await loadCommands(pathToFileURL(commandsPath));

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

    process.exit(0);
  } catch (err) {
    logger.error('❌ Error deploying commands:', { error: err });
    process.exit(1);
  }
})();
