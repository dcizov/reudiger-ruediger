import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { steamWishlists } from '../db/schema.js';
import { handleCommandError } from '../util/commandError.js';
import { getSteamStoreDetails, searchSteamApps } from '../util/steamWebApi.js';
import type { SubcommandCommand } from './index.js';

const MAX_WISHLIST_ITEMS = 20;

export default {
  data: new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Manage your Steam game wishlist')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a game to your wishlist')
        .addStringOption((opt) =>
          opt
            .setName('game')
            .setDescription('Game name')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addNumberOption((opt) =>
          opt
            .setName('target_price')
            .setDescription('Notify when price drops below this (€)')
            .setMinValue(0.01),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View your wishlist'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a game from your wishlist')
        .addStringOption((opt) =>
          opt
            .setName('game')
            .setDescription('Game to remove')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('clear').setDescription('Clear your entire wishlist'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add':
          return await handleAdd(interaction);
        case 'view':
          return await handleView(interaction);
        case 'remove':
          return await handleRemove(interaction);
        case 'clear':
          return await handleClear(interaction);
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      await handleCommandError(
        interaction,
        error,
        '❌ Failed to process wishlist command. Please try again later.',
      );
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused();

    // Autocomplete for /wishlist add - search all Steam games
    if (subcommand === 'add') {
      if (!focused || focused.length < 2) {
        await interaction.respond([]);
        return;
      }

      try {
        const results = await searchSteamApps(focused, 25);
        const suggestions = results.map((app) => ({
          name: app.name.slice(0, 100), // Discord autocomplete limit
          value: String(app.appid),
        }));

        await interaction.respond(suggestions);
      } catch {
        // Silently fail autocomplete - don't interrupt user
        await interaction.respond([]);
      }
    }

    // Autocomplete for /wishlist remove - show user's wishlist
    else if (subcommand === 'remove') {
      try {
        const items = await db.query.steamWishlists.findMany({
          where: eq(steamWishlists.userId, interaction.user.id),
        });

        const suggestions = items.slice(0, 25).map((item) => ({
          name: item.gameName,
          value: String(item.steamAppId),
        }));

        await interaction.respond(suggestions);
      } catch {
        // Silently fail autocomplete
        await interaction.respond([]);
      }
    } else {
      await interaction.respond([]);
    }
  },
} satisfies SubcommandCommand;

/**
 * Handle /wishlist add - Add a game to the user's wishlist
 * Defers reply due to external API calls
 */
async function handleAdd(interaction: ChatInputCommandInteraction) {
  const appIdStr = interaction.options.getString('game', true);
  const targetPriceEur = interaction.options.getNumber('target_price');
  const userId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse app ID from autocomplete value
  const appId = Number(appIdStr);

  if (isNaN(appId)) {
    await interaction.editReply(
      '❌ Invalid game selection. Please use the autocomplete suggestions.',
    );
    return;
  }

  // Check wishlist count limit
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(steamWishlists)
    .where(eq(steamWishlists.userId, userId));

  const count = countResult[0]?.count ?? 0;

  if (count >= MAX_WISHLIST_ITEMS) {
    await interaction.editReply(
      `❌ Wishlist limit reached (${MAX_WISHLIST_ITEMS} games).\n` +
        `Remove some games with \`/wishlist remove\` first.`,
    );
    return;
  }

  // Fetch game details from Steam
  const gameDetails = await getSteamStoreDetails(appId);

  if (!gameDetails?.data) {
    await interaction.editReply(
      '❌ Could not fetch game details from Steam.\n' +
        'The game may not be available or may have been removed from the store.',
    );
    return;
  }

  const game = gameDetails.data;

  // Get current price (in cents)
  const currentPriceCents = game.price_overview ? game.price_overview.final : 0;

  // Convert target price to cents
  const targetPriceCents = targetPriceEur
    ? Math.round(targetPriceEur * 100)
    : null;

  // Check for duplicates
  const existing = await db.query.steamWishlists.findFirst({
    where: and(
      eq(steamWishlists.userId, userId),
      eq(steamWishlists.steamAppId, appId),
    ),
  });

  if (existing) {
    await interaction.editReply(
      `❌ **${game.name}** is already in your wishlist!`,
    );
    return;
  }

  // Add to wishlist
  await db.insert(steamWishlists).values({
    userId,
    steamAppId: appId,
    gameName: game.name,
    addedPrice: currentPriceCents,
    targetPrice: targetPriceCents,
    notified: false,
  });

  // Create success message
  let reply = `✅ Added **${game.name}** to your wishlist!`;

  if (game.price_overview) {
    const currentPrice = (currentPriceCents / 100).toFixed(2);
    reply += `\n\n💰 Current Price: €${currentPrice}`;

    if (game.price_overview.discount_percent > 0) {
      reply += ` (-${game.price_overview.discount_percent}% off)`;
    }
  } else if (game.is_free) {
    reply += '\n\n💰 This game is Free to Play!';
  }

  if (targetPriceCents) {
    reply += `\n🔔 You'll be notified when the price drops below **€${targetPriceEur!.toFixed(2)}**`;
  }

  await interaction.editReply(reply);
}

/**
 * Handle /wishlist view - Display user's wishlist
 * No defer needed - simple DB query
 */
async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const items = await db
    .select()
    .from(steamWishlists)
    .where(eq(steamWishlists.userId, interaction.user.id))
    .orderBy(steamWishlists.createdAt);

  if (items.length === 0) {
    await interaction.editReply(
      '📭 Your wishlist is empty!\n' + 'Add games with `/wishlist add`',
    );
    return;
  }

  // Build wishlist description
  const list = items
    .map((item, i) => {
      const threshold = item.targetPrice
        ? ` • 🎯 Alert: €${(item.targetPrice / 100).toFixed(2)}`
        : '';
      return `\`${i + 1}.\` **${item.gameName}**${threshold}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`📚 Your Steam Wishlist (${items.length}/${MAX_WISHLIST_ITEMS})`)
    .setDescription(list.slice(0, 4096)) // Discord description limit
    .setColor(0x1b2838) // Steam blue
    .setFooter({
      text: 'Use /wishlist remove to remove games',
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle /wishlist remove - Remove a game from the wishlist
 * No defer needed - simple DB operation
 */
async function handleRemove(interaction: ChatInputCommandInteraction) {
  const appIdStr = interaction.options.getString('game', true);
  const userId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse app ID from autocomplete value
  const appId = Number(appIdStr);

  if (isNaN(appId)) {
    await interaction.editReply(
      '❌ Invalid game selection. Please use the autocomplete suggestions.',
    );
    return;
  }

  // Delete from wishlist
  const result = await db
    .delete(steamWishlists)
    .where(
      and(
        eq(steamWishlists.userId, userId),
        eq(steamWishlists.steamAppId, appId),
      ),
    )
    .returning();

  if (result.length === 0) {
    await interaction.editReply('❌ Game not found in your wishlist.');
    return;
  }

  const removedGame = result[0]!; // Safe: We checked length === 0 above

  await interaction.editReply(
    `✅ Removed **${removedGame.gameName}** from your wishlist.`,
  );
}

/**
 * Handle /wishlist clear - Remove all games from wishlist
 * No defer needed - simple DB operation
 */
async function handleClear(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await db
    .delete(steamWishlists)
    .where(eq(steamWishlists.userId, userId))
    .returning();

  if (result.length === 0) {
    await interaction.editReply('📭 Your wishlist was already empty.');
    return;
  }

  await interaction.editReply(
    `✅ Cleared ${result.length} game(s) from your wishlist.`,
  );
}
