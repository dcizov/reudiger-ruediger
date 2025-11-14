import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { steamProfiles } from '../db/schema.js';
import { handleCommandError } from '../util/commandError.js';
import { logger } from '../util/logger.js';
import {
  getOwnedGames,
  getPlayerSummary,
  getSteamStoreDetails,
  resolveSteamVanityUrl,
  searchSteamApps,
} from '../util/steamWebApi.js';
import type { SubcommandCommand } from './index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('steam')
    .setDescription('Steam profile and game commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('link')
        .setDescription('Link your Discord account to your Steam profile')
        .addStringOption((opt) =>
          opt
            .setName('steam_id')
            .setDescription('Your Steam ID, profile URL, or vanity URL')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('profile')
        .setDescription('View Steam profile information')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Discord user (defaults to you)'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('game')
        .setDescription('Look up Steam game details')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Game name')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'link':
          return await handleLink(interaction);
        case 'profile':
          return await handleProfile(interaction);
        case 'game':
          return await handleGameLookup(interaction);
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
        '❌ Failed to process Steam command. Please try again later.',
      );
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused();

    // Only provide autocomplete for /steam game
    if (subcommand === 'game') {
      try {
        // Show popular games when query is empty
        if (!focused || focused.length === 0) {
          const popularGames = [
            { name: 'Counter-Strike 2', value: '730' },
            { name: 'Dota 2', value: '570' },
            { name: 'Team Fortress 2', value: '440' },
            { name: 'PUBG: BATTLEGROUNDS', value: '578080' },
            { name: 'Apex Legends', value: '1172470' },
            { name: 'Grand Theft Auto V', value: '271590' },
            { name: 'Rust', value: '252490' },
            { name: 'Elden Ring', value: '1245620' },
            { name: "Baldur's Gate 3", value: '1086940' },
            { name: 'Cyberpunk 2077', value: '1091500' },
          ];
          return await interaction.respond(popularGames);
        }

        // Require 2+ characters for search
        if (focused.length < 2) {
          return await interaction.respond([]);
        }

        const results = await searchSteamApps(focused, 25);
        const suggestions = results.map((app) => ({
          name: app.name.slice(0, 100),
          value: String(app.appid),
        }));

        await interaction.respond(suggestions);
      } catch (error) {
        // Silently fail autocomplete - don't interrupt user
        logger.debug('Steam autocomplete error:', error);
        await interaction.respond([]);
      }
      return;
    }

    await interaction.respond([]);
  },
} satisfies SubcommandCommand;

/**
 * Handle /steam link - Link Discord account to Steam profile
 * Supports Steam IDs, profile URLs, and vanity URLs
 */
async function handleLink(interaction: ChatInputCommandInteraction) {
  const input = interaction.options.getString('steam_id', true);

  // Defer with ephemeral flag for privacy
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let steamId = input.trim();

  // Extract Steam ID from various URL patterns
  if (input.includes('steamcommunity.com')) {
    // Handle vanity URL: steamcommunity.com/id/vanityname
    const vanityMatch = /\/id\/([^\/\?#]+)/.exec(input);
    if (vanityMatch?.[1]) {
      const vanityUrl = vanityMatch[1];
      const resolved = await resolveSteamVanityUrl(vanityUrl);

      if (!resolved) {
        await interaction.editReply(
          `❌ Could not resolve vanity URL "${vanityUrl}".\n` +
            `Make sure your profile is set to public.`,
        );
        return;
      }

      steamId = resolved;
    } else {
      // Handle direct Steam ID URL: steamcommunity.com/profiles/76561198...
      const idMatch = /\/profiles\/(\d+)/.exec(input);
      if (idMatch?.[1]) {
        steamId = idMatch[1];
      }
    }
  }

  // Validate Steam ID format (64-bit Steam ID is 17 digits)
  if (!/^\d{17}$/.test(steamId)) {
    await interaction.editReply(
      '❌ Invalid Steam ID format.\n\n' +
        'Please provide one of the following:\n' +
        '• A 17-digit Steam ID (e.g., `76561198012345678`)\n' +
        '• Your Steam profile URL (e.g., `https://steamcommunity.com/profiles/76561198012345678`)\n' +
        '• Your Steam vanity URL (e.g., `https://steamcommunity.com/id/yourname`)',
    );
    return;
  }

  // Fetch Steam profile to validate
  const profile = await getPlayerSummary(steamId);

  if (!profile) {
    await interaction.editReply(
      '❌ Could not fetch Steam profile.\n' +
        'The profile may be private or the Steam ID is invalid.',
    );
    return;
  }

  // Upsert to database (insert or update if already exists)
  await db
    .insert(steamProfiles)
    .values({
      discordUserId: interaction.user.id,
      steamId: profile.steamid,
      personaName: profile.personaname,
      profileUrl: profile.profileurl,
      avatar: profile.avatarfull,
      isPublic: profile.communityvisibilitystate === 3,
      lastSynced: new Date(),
    })
    .onConflictDoUpdate({
      target: steamProfiles.discordUserId,
      set: {
        steamId: profile.steamid,
        personaName: profile.personaname,
        profileUrl: profile.profileurl,
        avatar: profile.avatarfull,
        isPublic: profile.communityvisibilitystate === 3,
        lastSynced: new Date(),
      },
    });

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('✅ Steam Profile Linked')
    .setDescription(`Successfully linked to **${profile.personaname}**`)
    .setThumbnail(profile.avatarfull)
    .addFields(
      {
        name: 'Profile Status',
        value:
          profile.communityvisibilitystate === 3 ? '🌐 Public' : '🔒 Private',
        inline: true,
      },
      {
        name: 'Steam ID',
        value: `\`${profile.steamid}\``,
        inline: true,
      },
    )
    .setColor(0x1b2838) // Steam blue
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle /steam profile - View Steam profile information
 * Shows game library, playtime, and recently played games (if profile is public)
 */
async function handleProfile(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;

  await interaction.deferReply();

  // Lookup linked Steam profile
  const linkedProfile = await db.query.steamProfiles.findFirst({
    where: eq(steamProfiles.discordUserId, targetUser.id),
  });

  if (!linkedProfile) {
    const message =
      targetUser.id === interaction.user.id
        ? "❌ You haven't linked a Steam profile yet.\n" +
          'Use `/steam link` to link your Steam account.'
        : `❌ **${targetUser.tag}** hasn't linked a Steam profile.`;

    await interaction.editReply(message);
    return;
  }

  // Fetch fresh profile data from Steam API
  const profile = await getPlayerSummary(linkedProfile.steamId);

  if (!profile) {
    await interaction.editReply('❌ Failed to fetch Steam profile data.');
    return;
  }

  // Create embed with profile information
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${profile.personaname}`)
    .setURL(profile.profileurl)
    .setThumbnail(profile.avatarfull)
    .setColor(0x1b2838)
    .addFields(
      {
        name: 'Profile Status',
        value:
          profile.communityvisibilitystate === 3 ? '🌐 Public' : '🔒 Private',
        inline: true,
      },
      {
        name: 'Steam ID',
        value: `\`${profile.steamid}\``,
        inline: true,
      },
    );

  // Fetch owned games if profile is public
  if (profile.communityvisibilitystate === 3) {
    const ownedGames = await getOwnedGames(linkedProfile.steamId, true);

    if (ownedGames && ownedGames.length > 0) {
      const totalPlaytime = ownedGames.reduce(
        (sum, game) => sum + game.playtime_forever,
        0,
      );

      embed.addFields(
        {
          name: '📚 Game Library',
          value: `${ownedGames.length} games`,
          inline: true,
        },
        {
          name: '⏱️ Total Playtime',
          value: `${Math.round(totalPlaytime / 60)} hours`,
          inline: true,
        },
      );

      // Show recently played games (last 2 weeks)
      const recentGames = ownedGames
        .filter((g) => g.playtime_2weeks && g.playtime_2weeks > 0)
        .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
        .slice(0, 5);

      if (recentGames.length > 0) {
        const recentList = recentGames
          .map(
            (g) =>
              `• ${g.name ?? 'Unknown'} (${Math.round((g.playtime_2weeks ?? 0) / 60)}h)`,
          )
          .join('\n');

        embed.addFields({
          name: '🎯 Recently Played (Last 2 Weeks)',
          value: recentList.slice(0, 1024), // Discord field value limit
        });
      }
    }
  } else {
    embed.addFields({
      name: '🔒 Private Profile',
      value: 'Game library is not visible.',
    });
  }

  // Add last online timestamp if available
  if (profile.lastlogoff) {
    embed.setFooter({
      text: `Last online: ${new Date(profile.lastlogoff * 1000).toLocaleString()}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle /steam game - Look up Steam game details
 * Shows price, developer, metacritic score, release date, etc.
 */
async function handleGameLookup(interaction: ChatInputCommandInteraction) {
  const appIdStr = interaction.options.getString('title', true);

  await interaction.deferReply();

  // Parse app ID from autocomplete value
  const appId = Number(appIdStr);

  if (isNaN(appId)) {
    await interaction.editReply(
      '❌ Invalid game selection. Please use the autocomplete suggestions.',
    );
    return;
  }

  // Fetch game details from Steam Store API
  const gameDetails = await getSteamStoreDetails(appId);

  if (!gameDetails?.data) {
    await interaction.editReply(
      '❌ Could not fetch game details from Steam.\n' +
        'The game may not be available or may have been removed from the store.',
    );
    return;
  }

  const game = gameDetails.data;

  // Create rich embed with game information
  const embed = new EmbedBuilder()
    .setTitle(game.name)
    .setURL(`https://store.steampowered.com/app/${game.steam_appid}`)
    .setDescription(
      game.short_description.length > 300
        ? game.short_description.slice(0, 297) + '...'
        : game.short_description,
    )
    .setImage(game.header_image)
    .setColor(0x1b2838);

  // Add price information
  if (game.price_overview) {
    const priceValue =
      game.price_overview.discount_percent > 0
        ? `~~${game.price_overview.initial_formatted}~~ **${game.price_overview.final_formatted}** (-${game.price_overview.discount_percent}%)`
        : game.price_overview.final_formatted;

    embed.addFields({
      name: '💰 Price',
      value: priceValue,
      inline: true,
    });
  } else if (game.is_free) {
    embed.addFields({
      name: '💰 Price',
      value: 'Free to Play',
      inline: true,
    });
  }

  // Add developer information
  if (game.developers && game.developers.length > 0) {
    embed.addFields({
      name: '👥 Developer',
      value: game.developers.join(', ').slice(0, 1024),
      inline: true,
    });
  }

  // Add Metacritic score
  if (game.metacritic) {
    embed.addFields({
      name: '🎯 Metacritic',
      value: `${game.metacritic.score}/100`,
      inline: true,
    });
  }

  // Add release date
  if (game.release_date) {
    const releaseValue = game.release_date.coming_soon
      ? `Coming ${game.release_date.date}`
      : game.release_date.date;

    embed.addFields({
      name: '📅 Release Date',
      value: releaseValue,
      inline: true,
    });
  }

  // Add genres
  if (game.genres && game.genres.length > 0) {
    embed.addFields({
      name: '🏷️ Genres',
      value: game.genres
        .map((g) => g.description)
        .join(', ')
        .slice(0, 1024),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
