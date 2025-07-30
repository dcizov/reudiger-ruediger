import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { config as env } from "../config";
import { db } from "../db/index";
import { subscriptions } from "../db/schema";
import type { Command } from "../types/command";
import {
  getItadEurPrices,
  getItadGameId,
  getItadHistoricalLow,
} from "../utils/itadPrice";
import { searchItadGames } from "../utils/itadSearch";

export const subscribe: Command = {
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Subscribe to game price updates")
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("The exact game name you want to track")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addNumberOption((opt) =>
      opt
        .setName("price_below")
        .setDescription("Only notify when price drops below this (€)")
        .setMinValue(0.01)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString("title", true);
    const userId = interaction.user.id;
    const username = interaction.user.tag;
    const apiKey = env.ITAD_API_KEY;
    if (!apiKey) {
      await interaction.reply({
        content: "❌ Missing ITAD API key.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const gameId = await getItadGameId(apiKey, title);
    if (!gameId) {
      await interaction.editReply(`❌ Game "${title}" not found.`);
      return;
    }

    const eurPrices = await getItadEurPrices(apiKey, [gameId]);
    const price = eurPrices[gameId];
    if (!price) {
      await interaction.editReply(
        `❌ Could not fetch current price for "${title}".`
      );
      return;
    }

    const historical = await getItadHistoricalLow(apiKey, gameId);
    if (!historical) {
      await interaction.editReply("❌ Could not fetch historical low.");
      return;
    }

    // Check if already subscribed
    const existing = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.gameId, gameId),
        eq(subscriptions.userId, userId)
      ),
    });

    if (existing) {
      await interaction.editReply(
        `⚠️ You are already subscribed to **${title}**.`
      );
      return;
    }

    const priceBelowRaw = interaction.options.getNumber("price_below");
    const priceBelow =
      priceBelowRaw !== null ? Math.round(priceBelowRaw * 100) : null;

    await db.insert(subscriptions).values({
      userId,
      username,
      gameId,
      title,
      historicalLow: Math.round(historical.price * 100),
      currentPrice: Math.round(price.price_new * 100),
      targetPrice: priceBelow,
      notified: false,
    });

    let reply = `✅ Subscribed to **${title}**.\n\n📉 Current: €${price.price_new.toFixed(2)}\n📈 Historical Low: €${historical.price.toFixed(2)}`;

    if (priceBelow) {
      reply += `\n🔔 You will be notified only if the price drops below **€${priceBelowRaw!.toFixed(2)}**.`;
    } else {
      reply += `\n🔔 You’ll be notified for any price drop.`;
    }

    await interaction.editReply({ content: reply });
  },
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const apiKey = env.ITAD_API_KEY;
    const focused = interaction.options.getFocused();

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
