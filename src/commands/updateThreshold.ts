import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { subscriptions } from "../db/schema";
import type { Command } from "../types/command";

export const updateThreshold: Command = {
  data: new SlashCommandBuilder()
    .setName("update_threshold")
    .setDescription("Update the alert price threshold of a subscription")
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Game title of the existing subscription")
        .setRequired(true)
    )
    .addNumberOption((opt) =>
      opt
        .setName("new_price")
        .setDescription("New price threshold (€)")
        .setRequired(true)
        .setMinValue(0.01)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString("title", true);
    const newPrice = interaction.options.getNumber("new_price", true);
    const newPriceCents = Math.round(newPrice * 100);
    const userId = interaction.user.id;

    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.title, title)
      ),
    });

    if (!sub) {
      await interaction.reply({
        content: `❌ No subscription found for **${title}**.`,
        ephemeral: true,
      });
      return;
    }

    await db
      .update(subscriptions)
      .set({ targetPrice: newPriceCents, notified: false }) // reset to re-notify
      .where(eq(subscriptions.id, sub.id));

    await interaction.reply({
      content: `🎯 Updated threshold for **${title}** to €${newPrice.toFixed(2)}.`,
      ephemeral: true,
    });
  },
};
