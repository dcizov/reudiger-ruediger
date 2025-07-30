import {
  ChannelType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/command";
import {
  setDealsChannelId,
  setLogChannelId,
  setSchedule,
} from "../utils/botConfig";

export const setup: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Admin: Set up deal posting, schedule, and debug/log channel")
    .addChannelOption((option) =>
      option
        .setName("deals_channel")
        .setDescription("📢 Where to post game deals")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("log_channel")
        .setDescription("🧪 Log channel for errors, dev info, etc")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("schedule")
        .setDescription("⏰ Cron schedule, e.g. '*/30 * * * *' for every 30 mins")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      await interaction.reply({
        content: "🚫 You need to be an administrator to use this command.",
        ephemeral: true,
      });
      return;
    }

    const dealsChannel = interaction.options.getChannel("deals_channel", true);
    const logChannel = interaction.options.getChannel("log_channel", false);
    const schedule = interaction.options.getString("schedule");

    await setDealsChannelId(dealsChannel.id);

    let message = `✅ Deal channel set to <#${dealsChannel.id}>`;

    if (logChannel) {
      await setLogChannelId(logChannel.id);
      message += `\n🧪 Log/debug channel set to <#${logChannel.id}>`;
    }

    if (schedule) {
      await setSchedule(schedule);
      message += `\n⏰ Cron schedule set to \`${schedule}\``;
    }

    await interaction.reply({
      content: message,
      ephemeral: true,
    });
  },
};