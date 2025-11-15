import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import type { Command } from './index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and list all available commands'),

  async execute(interaction: ChatInputCommandInteraction) {
    const isAdmin =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ??
      false;

    const embed = new EmbedBuilder()
      .setTitle('🆘 Help • Game Deals Bot')
      .setDescription("Here's what I can do 👇")
      .setColor(0x00ae86);

    embed.addFields(
      {
        name: '📉 Game Price Lookup',
        value:
          '`/compare <title>` — Compare current price with historical lowest',
      },
      {
        name: '🔔 Subscriptions',
        value: [
          "`/subscription add <title> [price_below]` — Track a game and get alerts when it's cheaper",
          "`/subscription list` — List all games you're tracking",
          '`/subscription remove <title>` — Stop tracking a specific game',
          '`/subscription clear` — Remove all tracked games',
          '`/subscription update <title> <new_price>` — Update your alert price',
          '`/subscription notify` — Toggle all subscription alerts on or off',
        ].join('\n'),
      },
      {
        name: '🎮 Steam Integration',
        value: [
          '`/steam link <profile>` — Link your Steam account',
          '`/steam profile` — View your Steam profile and library stats',
          '`/steam game <title>` — Look up game details and pricing',
        ].join('\n'),
      },
      {
        name: '⭐ Steam Wishlist',
        value: [
          '`/wishlist add <game> [target_price]` — Add game to wishlist with optional price alert',
          '`/wishlist view` — View your Steam wishlist',
          '`/wishlist remove <game>` — Remove game from wishlist',
          '`/wishlist clear` — Clear your entire wishlist',
        ].join('\n'),
      },
      {
        name: '📊 Deal Quality Filters',
        value: [
          '• Posts only deals **≥70% off** OR',
          '• **Historical all-time lows** (≥50% off) OR',
          '• **Highly-rated games** (≥7.0 rating) with ≥50% discount',
          '• Maximum 5 best deals per posting session',
          '• Automated posts: **9 AM, 3 PM, 9 PM** daily',
        ].join('\n'),
      },
      {
        name: '💬 Target Price Feature',
        value:
          'When subscribing, you can choose to only be alerted when a game drops below a specific price.\nFor example:\n`/subscription add title: Cyberpunk 2077 price_below: 19.99`',
      },
    );

    if (isAdmin) {
      embed.addFields(
        {
          name: '⚙️ Admin: Deal Management',
          value: [
            '`/deal` — Manually post deals (bypasses schedule)',
            '`/cleanup` — Remove expired deal messages',
          ].join('\n'),
        },
        {
          name: '⚙️ Admin: Bot Setup',
          value: [
            '`/setup channels <deals> [log]` — Configure where to post deals and logs',
            '`/setup roles <channel> <role1...>` — Create reaction role message with buttons',
            '`/setup schedule <cron>` — Set posting schedule (default: 9 AM, 3 PM, 9 PM)',
            '`/setup view` — View current bot configuration',
          ].join('\n'),
        },
        {
          name: '📰 Admin: News Configuration',
          value: [
            '`/news list` - View all news sources and their status',
            '`/news enable <source>` - Enable a specific news source',
            '`/news disable <source>` - Disable a specific news source',
            '\n**Available:** CS2, Valheim, WoW Retail, Classic, PTR, Beta, Blue Tracker, Hotfixes, Guides',
          ].join('\n'),
        },
      );
    }

    embed.addFields({
      name: '🙋 Questions?',
      value: isAdmin
        ? 'You have **Administrator** permissions and can see all commands above!'
        : 'Ask your server admin or type `/help` anytime!',
    });

    embed.setFooter({
      text: 'Game Deals Bot • Powered by IsThereAnyDeal.com & Steam',
      iconURL: 'https://isthereanydeal.com/assets/favicon.png',
    });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
