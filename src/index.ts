import type { InteractionReplyOptions, MessagePayload } from "discord.js";
import { Client, Events, GatewayIntentBits, Interaction } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";
import { startDealScheduler } from "./services/schedulerService";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// Start scheduler when bot is ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Discord bot is ready! Logged in as ${readyClient.user.tag}`);
  void startDealScheduler(client);
});

// Handle interactions
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // Autocomplete handler
  if (interaction.isAutocomplete()) {
    const command = commands[interaction.commandName];
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(
          `Error during autocomplete: ${interaction.commandName}`,
          error
        );
      }
    }
    return;
  }

  // Slash command handler
  if (interaction.isChatInputCommand()) {
    const command = commands[interaction.commandName];
    if (!command) return;

    try {
      await command.execute(interaction);

      if (interaction.commandName === "setup") {
        await startDealScheduler(client);
      }
    } catch (error) {
      console.error(
        `❌ Error executing command ${interaction.commandName}:`,
        error
      );

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
  }
});

if (!config.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing from config.");
  process.exit(1);
}

client.login(config.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Failed to log in to Discord:", err);
  process.exit(1);
});