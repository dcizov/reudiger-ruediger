import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/command";
import { postNewDeals } from "../services/postNewDeals";

export const deal: Command = {
  data: new SlashCommandBuilder()
    .setName("deal")
    .setDescription("Post the latest game deals in the configured channel"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const posted = await postNewDeals(interaction.client, 5);
      if (posted > 0) {
        await interaction.editReply(
          `✅ Posted ${posted} new deal(s) in the configured channel.`
        );
      } else {
        await interaction.editReply("No new deals to post.");
      }
    } catch (err) {
      await interaction.editReply("Failed to post deals due to an error.");
    }
  },
};
