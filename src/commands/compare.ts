import {
  EmbedBuilder,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { env } from '../config';
import type { Command } from '../types/command';
import { getItadGameId, getItadGameOverview } from '../utils/itadPrice';
import { searchItadGames } from '../utils/itadSearch';

export const compare: Command = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription(
      "Compare a game's current deal with its historical lowest price",
    )
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('The title of the game')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const title = interaction.options.getString('title', true);
    const apiKey = env.ITAD_API_KEY;
    if (!apiKey) {
      await interaction.editReply('❌ Missing ITAD API Key.');
      return;
    }

    const gameId = await getItadGameId(apiKey, title);
    if (!gameId) {
      await interaction.editReply(
        `❌ Could not find "${title}" on IsThereAnyDeal.`,
      );
      return;
    }

    const overviewData = await getItadGameOverview(apiKey, [gameId]);
    const gameData = overviewData[gameId];

    if (!gameData) {
      await interaction.editReply(
        `❌ No price data found for "${title}".\n` +
          `The game may not be available in your region or hasn't been released yet.`,
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${title}`)
      .setURL(gameData.url)
      .setColor(0x00ae86)
      .addFields(
        {
          name: '💰 Current Price',
          value: `€${gameData.currentPrice.toFixed(2)}`,
          inline: true,
        },
        {
          name: '💸 Normal Price',
          value: `~~€${gameData.regularPrice.toFixed(2)}~~`,
          inline: true,
        },
        {
          name: '📉 Discount',
          value: gameData.cut > 0 ? `-${gameData.cut}%` : 'No discount',
          inline: true,
        },
        {
          name: '📉 Historical Low',
          value: `€${gameData.historicalLow.toFixed(2)} • ${
            gameData.isLowest ? '**New all-time low!** 🔥' : 'Not lowest'
          }`,
          inline: true,
        },
        {
          name: '🏪 Best Store',
          value: gameData.shop,
          inline: true,
        },
        {
          name: '🌍 Region',
          value: '🇪🇺 EU (DE)',
          inline: true,
        },
        {
          name: '🔗 Links',
          value: `[🛒 Open Deal](${gameData.url})`,
          inline: false,
        },
      )
      .setFooter({
        text: 'Data via IsThereAnyDeal.com • Prices may vary by region',
        iconURL: 'https://isthereanydeal.com/assets/favicon.png',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    const apiKey = env.ITAD_API_KEY;
    if (!apiKey || !focused || focused.length < 2) {
      await interaction.respond([]);
      return;
    }

    const results = await searchItadGames(apiKey, focused);
    const suggestions = results.map((title) => ({
      name: title,
      value: title,
    }));

    await interaction.respond(suggestions.slice(0, 25));
  },
};
