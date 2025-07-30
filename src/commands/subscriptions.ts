import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { subscriptions } from "../db/schema";
import type { Command } from "../types/command";

export const subscriptionsList: Command = {
  data: new SlashCommandBuilder()
    .setName("subscriptions")
    .setDescription("List all the games you're subscribed to"),

  async execute(interaction: ChatInputCommandInteraction) {
    const subs = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, interaction.user.id),
    });

    if (subs.length === 0) {
      await interaction.reply({
        content: "📭 You don't have any active subscriptions.",
        ephemeral: true,
      });
      return;
    }

    const list = subs
      .map((sub, i) => {
        const current =
          sub.currentPrice != null
            ? `€${(sub.currentPrice / 100).toFixed(2)}`
            : "N/A";
        const threshold =
          sub.targetPrice != null
            ? ` • 🎯 Alert under €${(sub.targetPrice / 100).toFixed(2)}`
            : "";
        return `\`${i + 1}.\` **${sub.title}** – ${current}${threshold}`;
      })
      .join("\n");

    await interaction.reply({
      content: `📋 **You're tracking ${subs.length} game(s):**\n\n${list}`,
      ephemeral: true,
    });
  },
};
