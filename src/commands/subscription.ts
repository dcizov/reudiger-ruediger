import {
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { env } from '../config';
import { db } from '../db/index';
import { subscriptions, userSettings } from '../db/schema';
import type { SubcommandCommand } from '../types/command';
import { getItadGameId, getItadGameOverview } from '../utils/itadPrice';
import { searchItadGames } from '../utils/itadSearch';

const MAX_SUBSCRIPTIONS_PER_USER = 20;

export const subscription: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('subscription')
    .setDescription('Manage your game price subscriptions')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Subscribe to game price updates')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('The exact game name you want to track')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addNumberOption((opt) =>
          opt
            .setName('price_below')
            .setDescription('Only notify when price drops below this (€)')
            .setMinValue(0.01),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Unsubscribe from a game')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('The game title you want to unsubscribe from')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription("Unsubscribe from all games you're tracking"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription("List all the games you're subscribed to"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('update')
        .setDescription('Update the alert price threshold of a subscription')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Game title of the existing subscription')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addNumberOption((opt) =>
          opt
            .setName('new_price')
            .setDescription('New price threshold (€)')
            .setRequired(true)
            .setMinValue(0.01),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('notify')
        .setDescription('Toggle subscription notifications on or off'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        return handleAdd(interaction);
      case 'remove':
        return handleRemove(interaction);
      case 'clear':
        return handleClear(interaction);
      case 'list':
        return handleList(interaction);
      case 'update':
        return handleUpdate(interaction);
      case 'notify':
        return handleNotify(interaction);
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: MessageFlags.Ephemeral,
        });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const apiKey = env.ITAD_API_KEY;
    const focused = interaction.options.getFocused();

    if (
      (subcommand === 'add' || subcommand === 'update') &&
      apiKey &&
      focused &&
      focused.length >= 2
    ) {
      const results = await searchItadGames(apiKey, focused);
      const suggestions = results.map((title) => ({
        name: title,
        value: title,
      }));

      await interaction.respond(suggestions.slice(0, 25));
      return;
    }

    await interaction.respond([]);
  },
};

async function handleAdd(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const userId = interaction.user.id;
  const username = interaction.user.tag;
  const apiKey = env.ITAD_API_KEY;

  if (!apiKey) {
    await interaction.reply({
      content: '❌ Missing ITAD API key.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userSubscriptions = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
  });

  if (userSubscriptions.length >= MAX_SUBSCRIPTIONS_PER_USER) {
    await interaction.editReply(
      `❌ You have reached the maximum limit of **${MAX_SUBSCRIPTIONS_PER_USER} subscriptions**. Please remove some subscriptions before adding new ones.`,
    );
    return;
  }

  const gameId = await getItadGameId(apiKey, title);
  if (!gameId) {
    await interaction.editReply(`❌ Game "${title}" not found.`);
    return;
  }

  const overviewData = await getItadGameOverview(apiKey, [gameId]);
  const gameData = overviewData[gameId];

  if (!gameData) {
    await interaction.editReply(
      `❌ Could not fetch price data for "${title}".\n` +
        `The game may not be available in your region or hasn't been released yet.`,
    );
    return;
  }

  const existing = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.gameId, gameId),
      eq(subscriptions.userId, userId),
    ),
  });

  if (existing) {
    await interaction.editReply(
      `⚠️ You are already subscribed to **${title}**.`,
    );
    return;
  }

  const priceBelowRaw = interaction.options.getNumber('price_below');
  const priceBelow =
    priceBelowRaw !== null ? Math.round(priceBelowRaw * 100) : null;

  await db.insert(subscriptions).values({
    userId,
    username,
    gameId,
    title,
    historicalLow: Math.round(gameData.historicalLow * 100),
    currentPrice: Math.round(gameData.currentPrice * 100),
    targetPrice: priceBelow,
    notified: false,
  });

  let reply = `✅ Subscribed to **${title}**.\n\n📉 Current: €${gameData.currentPrice.toFixed(2)}`;

  if (gameData.cut > 0) {
    reply += ` (${gameData.cut}% off, was €${gameData.regularPrice.toFixed(2)})`;
  }

  reply += `\n📈 Historical Low: €${gameData.historicalLow.toFixed(2)}`;

  if (gameData.isLowest) {
    reply += ` 🔥 **LOWEST PRICE EVER!**`;
  }

  if (priceBelow) {
    reply += `\n🔔 You will be notified only if the price drops below **€${priceBelowRaw!.toFixed(2)}**.`;
  } else {
    reply += `\n🔔 You'll be notified for any price drop.`;
  }

  await interaction.editReply({ content: reply });
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const userId = interaction.user.id;

  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.title, title),
      eq(subscriptions.userId, userId),
    ),
  });

  if (!sub) {
    await interaction.reply({
      content: `❌ You're not subscribed to **${title}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));

  await interaction.reply({
    content: `🗑️ Unsubscribed from **${title}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleClear(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const all = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
  });

  if (all.length === 0) {
    await interaction.reply({
      content: '📭 You are not subscribed to any games.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));

  await interaction.reply({
    content: `🗑️ You have unsubscribed from **${all.length}** game(s).`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, interaction.user.id),
  });

  if (subs.length === 0) {
    await interaction.reply({
      content: "📭 You don't have any active subscriptions.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const list = subs
    .map((sub, i) => {
      const current =
        sub.currentPrice != null
          ? `€${(sub.currentPrice / 100).toFixed(2)}`
          : 'N/A';
      const threshold =
        sub.targetPrice != null
          ? ` • 🎯 Alert under €${(sub.targetPrice / 100).toFixed(2)}`
          : '';
      return `\`${i + 1}.\` **${sub.title}** – ${current}${threshold}`;
    })
    .join('\n');

  await interaction.reply({
    content: `📋 **You're tracking ${subs.length} game(s):**\n\n${list}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleUpdate(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const newPrice = interaction.options.getNumber('new_price', true);
  const newPriceCents = Math.round(newPrice * 100);
  const userId = interaction.user.id;

  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.title, title),
    ),
  });

  if (!sub) {
    await interaction.reply({
      content: `❌ No subscription found for **${title}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await db
    .update(subscriptions)
    .set({ targetPrice: newPriceCents, notified: false })
    .where(eq(subscriptions.id, sub.id));

  await interaction.reply({
    content: `🎯 Updated threshold for **${title}** to €${newPrice.toFixed(2)}.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleNotify(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

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
      ? '🔔 Notifications enabled.'
      : '🔕 Notifications disabled.',
    flags: MessageFlags.Ephemeral,
  });
}
