import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  ChannelType,
} from "discord.js";
import { setDealsChannelId, setSchedule } from "../utils/botConfig";
import type { Command } from "../types/command";

export const setup: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set the channel and schedule for posting game deals")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to post deals in")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("schedule")
        .setDescription("Cron schedule (e.g. '0 10 * * *' for 10:00 every day)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      await interaction.reply({
        content: "You need to be an admin to use this command.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel("channel", true);
    await setDealsChannelId(channel.id);

    const schedule = interaction.options.getString("schedule");
    if (schedule) {
      await setSchedule(schedule);
    }

    await interaction.reply({
      content: `✅ Deals will be posted in <#${channel.id}>${schedule ? ` on schedule \`${schedule}\`` : ""}`,
      ephemeral: true,
    });
  },
};
