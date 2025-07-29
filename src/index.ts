import type { InteractionReplyOptions, MessagePayload } from "discord.js";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";
import { restartDealScheduler } from "./services/schedulerService";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Discord bot is ready! Logged in as ${readyClient.user.tag}`);
  // Start the scheduler initially
  void restartDealScheduler(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];
  if (!command) return;

  try {
    await command.execute(interaction);

    // If the setup command was run, restart the scheduler
    if (interaction.commandName === "setup") {
      await restartDealScheduler(client);
    }
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const replyMethod =
      interaction.replied || interaction.deferred
        ? (options: string | InteractionReplyOptions | MessagePayload) =>
            interaction.followUp(options)
        : (options: string | InteractionReplyOptions | MessagePayload) =>
            interaction.reply(options);

    await replyMethod({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
});

client.login(config.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
  process.exit(1);
});
