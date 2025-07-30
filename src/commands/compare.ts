import {
  EmbedBuilder,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { config as env } from "../config";
import type { Command } from "../types/command";
import {
  getItadEurPrices,
  getItadGameId,
  getItadHistoricalLow,
} from "../utils/itadPrice";
import { searchItadGames } from "../utils/itadSearch";

export const compare: Command = {
  data: new SlashCommandBuilder()
    .setName("compare")
    .setDescription(
      "Compare a game's current deal with its historical lowest price"
    )
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("The title of the game")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const title = interaction.options.getString("title", true);
    const apiKey = env.ITAD_API_KEY;
    if (!apiKey) {
      await interaction.editReply("❌ Missing ITAD API Key.");
      return;
    }

    const gameId = await getItadGameId(apiKey, title);
    if (!gameId) {
      await interaction.editReply(
        `❌ Could not find "${title}" on IsThereAnyDeal.`
      );
      return;
    }

    const eurPrices = await getItadEurPrices(apiKey, [gameId]);
    const price = eurPrices[gameId];
    if (!price) {
      await interaction.editReply(`❌ No price data found for "${title}".`);
      return;
    }

    const historical = await getItadHistoricalLow(apiKey, gameId);
    if (!historical) {
      await interaction.editReply("❌ Failed to fetch historical low.");
      return;
    }

    const savingsPercent = (
      ((price.price_old - price.price_new) / price.price_old) *
      100
    ).toFixed(0);

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${title}`)
      .setURL(price.url)
      .setColor(0x00ae86)
      .addFields(
        {
          name: "💰 Current Price",
          value: `€${price.price_new.toFixed(2)}`,
          inline: true,
        },
        {
          name: "💸 Normal Price",
          value: `~~€${price.price_old.toFixed(2)}~~`,
          inline: true,
        },
        {
          name: "📉 Discount",
          value: `-${savingsPercent}%`,
          inline: true,
        },
        {
          name: "📉 Historical Low",
          value: `€${historical.price.toFixed(2)} • ${
            historical.isLowest ? "**New all-time low!**" : "Not lowest"
          }`,
          inline: true,
        },
        {
          name: "🏪 Best Store",
          value: price.shop,
          inline: true,
        },
        {
          name: "🌍 Region",
          value: "🇪🇺 EU (DE)",
          inline: true,
        },
        {
          name: "🔗 Links",
          value: `[🛒 Open Deal](${price.url})`,
          inline: false,
        }
      )
      .setFooter({
        text: "Data via IsThereAnyDeal.com • Prices may vary by region",
        iconURL: "https://isthereanydeal.com/assets/favicon.png",
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
