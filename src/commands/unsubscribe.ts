import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { subscriptions } from "../db/schema";
import type { Command } from "../types/command";

export const unsubscribe: Command = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe")
    .setDescription("Unsubscribe from a game")
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("The game title you want to unsubscribe from")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString("title", true);
    const userId = interaction.user.id;

    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.title, title),
        eq(subscriptions.userId, userId)
      ),
    });

    if (!sub) {
      await interaction.reply({
        content: `❌ You're not subscribed to **${title}**.`,
        ephemeral: true,
      });
      return;
    }

    await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));

    await interaction.reply({
      content: `🗑️ Unsubscribed from **${title}**.`,
      ephemeral: true,
    });
  },
};
