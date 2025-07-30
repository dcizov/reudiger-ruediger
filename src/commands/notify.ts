import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { userSettings } from "../db/schema";
import type { Command } from "../types/command";

export const notify: Command = {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Toggle subscription notifications on or off"),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;

    const existing = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    // Flip the current setting
    const newValue = !existing?.notificationsEnabled;

    if (existing) {
      await db
        .update(userSettings)
        .set({ notificationsEnabled: newValue })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        notificationsEnabled: newValue,
      });
    }

    await interaction.reply({
      content: newValue
        ? "🔔 Notifications enabled."
        : "🔕 Notifications disabled.",
      ephemeral: true,
    });
  },
};
