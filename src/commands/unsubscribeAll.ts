import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { subscriptions } from "../db/schema";
import type { Command } from "../types/command";

export const unsubscribeAll: Command = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe_all")
    .setDescription("Unsubscribe from **all** games you're tracking"),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;

    const all = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, userId),
    });

    if (all.length === 0) {
      await interaction.reply({
        content: "📭 You are not subscribed to any games.",
        ephemeral: true,
      });
      return;
    }

    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));

    await interaction.reply({
      content: `🗑️ You have unsubscribed from **${all.length}** game(s).`,
      ephemeral: true,
    });
  },
};
