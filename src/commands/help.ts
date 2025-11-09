import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

import type { Command } from '../types/command';

export const help: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and list all available commands'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🆘 Help • Game Deals Bot')
      .setDescription("Here's what I can do 👇")
      .setColor(0x00ae86)
      .addFields(
        {
          name: '🎯 Deal Posting',
          value: [
            '`/deal` — Post the top new game deals',
            '`/cleanup` — Remove expired deal messages',
          ].join('\n'),
        },
        {
          name: '📉 Compare Game Price',
          value:
            '`/compare <title>` — Compare current deal with historical lowest price',
        },
        {
          name: '🔔 Subscriptions',
          value: [
            "`/subscription add <title> [price_below]` — Track a game and get alerts when it's cheaper",
            "`/subscription list` — List all games you're tracking",
            '`/subscription remove <title>` — Stop tracking a specific game',
            '`/subscription clear` — Remove all tracked games',
            '`/subscription update <title> <new_price>` — Update your alert price for a tracked game',
            '`/subscription notify` — Toggle all subscription alerts on or off',
          ].join('\n'),
        },
        {
          name: '⚙️ Admin Setup (Administrator only)',
          value: [
            '`/setup channels <deals> [log]` — Configure where to post deals and logs',
            '`/setup roles <channel> <role1...>` — Create a reaction role message with buttons',
            '`/setup schedule <cron>` — Set the cron schedule for automated deal posting',
            '`/setup view` — View current bot configuration',
          ].join('\n'),
        },
        {
          name: '💬 Target Price Feature',
          value:
            'When subscribing, you can choose to only be alerted when a game drops below a specific price.\nFor example:\n`/subscription add title: Cyberpunk 2077 price_below: 19.99`',
        },
        {
          name: '🙋 Questions?',
          value: 'Ask your server admin or type `/help` anytime!',
        },
      )
      .setFooter({
        text: 'Game Deals Bot • Powered by IsThereAnyDeal.com & CheapShark',
        iconURL: 'https://isthereanydeal.com/assets/favicon.png',
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
