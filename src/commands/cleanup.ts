import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { postedNews } from '../db/schema';
import { cleanupExpiredDeals } from '../services/cleanupDeals';
import { cleanupRoles } from '../services/cleanupRoles';
import { cleanupOldPostedNews } from '../services/newsService';
import type { SubcommandCommand } from '../types/command';
import { logger } from '../utils/logger';

export const cleanup: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Admin: Cleanup and maintenance operations')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deals')
        .setDescription('Remove expired deals from the channel'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('news')
        .setDescription('Remove old posted news entries (older than 30 days)'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('news-source')
        .setDescription(
          'Clear posted news for a specific source to allow reposting',
        )
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('News source to clear')
            .setRequired(true)
            .addChoices(
              { name: '🎮 Counter-Strike 2', value: 'cs2' },
              { name: '⚔️ Valheim', value: 'valheim' },
              { name: '🏰 WoW Retail', value: 'wowRetail' },
              { name: '🔨 WoW In Development', value: 'wowInDev' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('roles')
        .setDescription(
          'Remove orphaned role messages and invalid role references',
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('all')
        .setDescription('Run all cleanup tasks (deals + news)'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'deals':
        return handleDealsCleanup(interaction);
      case 'news':
        return handleNewsCleanup(interaction);
      case 'news-source':
        return handleNewsSourceCleanup(interaction);
      case 'roles':
        return handleRolesCleanup(interaction);
      case 'all':
        return handleAllCleanup(interaction);
      default:
        await interaction.editReply({
          content: '❌ Unknown subcommand.',
        });
    }
  },
};

/**
 * Handle /cleanup deals subcommand
 */
async function handleDealsCleanup(interaction: ChatInputCommandInteraction) {
  try {
    const removed = await cleanupExpiredDeals(interaction.client, true);

    if (removed === 0) {
      await interaction.editReply({
        content: '✅ No expired deals found.',
      });
    } else {
      await interaction.editReply({
        content: `🧹 Cleaned up **${removed}** expired deal(s).`,
      });
    }
  } catch (error) {
    logger.error('Deals cleanup error:', { error });
    await interaction.editReply({
      content: '❌ Failed to cleanup deals due to an error.',
    });
  }
}

/**
 * Handle /cleanup news subcommand
 */
async function handleNewsCleanup(interaction: ChatInputCommandInteraction) {
  try {
    const removed = await cleanupOldPostedNews();

    if (removed === 0) {
      await interaction.editReply({
        content: '✅ No old news entries found (older than 30 days).',
      });
    } else {
      await interaction.editReply({
        content: `🗑️ Cleaned up **${removed}** old news entr${removed === 1 ? 'y' : 'ies'}.`,
      });
    }
  } catch (error) {
    logger.error('News cleanup error:', { error });
    await interaction.editReply({
      content: '❌ Failed to cleanup news entries due to an error.',
    });
  }
}

/**
 * Handle /cleanup news-source subcommand
 */
async function handleNewsSourceCleanup(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId) {
    await interaction.editReply({
      content: '❌ This command must be used in a server.',
    });
    return;
  }

  const source = interaction.options.getString('source', true);

  try {
    const result = await db
      .delete(postedNews)
      .where(
        and(
          eq(postedNews.source, source),
          eq(postedNews.guildId, interaction.guildId),
        ),
      );

    const deleted = result.length;

    if (deleted === 0) {
      await interaction.editReply({
        content: `✅ No posted news found for **${source}**.`,
      });
    } else {
      await interaction.editReply({
        content: `🗑️ Cleared **${deleted}** posted news entr${deleted === 1 ? 'y' : 'ies'} for **${source}**.\n\nThese articles will be reposted on the next news check.`,
      });
    }
  } catch (error) {
    logger.error('News source cleanup error:', { error, source });
    await interaction.editReply({
      content: '❌ Failed to cleanup news source due to an error.',
    });
  }
}

/**
 * Handle /cleanup roles subcommand
 */
async function handleRolesCleanup(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply({
      content: '❌ This command must be used in a server.',
    });
    return;
  }

  try {
    const result = await cleanupRoles(interaction.client, interaction.guildId);

    const totalCleaned =
      result.orphanedMessages + result.invalidRoles + result.oldCooldowns;

    if (totalCleaned === 0) {
      await interaction.editReply({
        content: '✅ No role cleanup needed - everything is clean!',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎭 Role Cleanup Complete')
      .setColor(0x5865f2)
      .addFields(
        {
          name: '🗑️ Orphaned Messages',
          value:
            result.orphanedMessages === 0
              ? 'None found'
              : `Removed ${result.orphanedMessages}`,
          inline: true,
        },
        {
          name: '❌ Invalid Roles',
          value:
            result.invalidRoles === 0
              ? 'None found'
              : `Removed ${result.invalidRoles} buttons`,
          inline: true,
        },
        {
          name: '⏰ Old Cooldowns',
          value:
            result.oldCooldowns === 0
              ? 'None found'
              : `Removed ${result.oldCooldowns}`,
          inline: true,
        },
      )
      .setFooter({ text: `Total items cleaned: ${totalCleaned}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Roles cleanup error:', { error });
    await interaction.editReply({
      content: '❌ Failed to cleanup roles due to an error.',
    });
  }
}

/**
 * Handle /cleanup all subcommand
 */
async function handleAllCleanup(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply({
      content: '❌ This command must be used in a server.',
    });
    return;
  }

  try {
    const results: {
      task: string;
      count: number;
      icon: string;
    }[] = [];

    try {
      const dealsRemoved = await cleanupExpiredDeals(interaction.client);
      results.push({
        task: 'Expired Deals',
        count: dealsRemoved,
        icon: '🧹',
      });
    } catch (error) {
      logger.error('Deals cleanup failed in all cleanup:', { error });
      results.push({
        task: 'Expired Deals',
        count: -1,
        icon: '❌',
      });
    }

    try {
      const newsRemoved = await cleanupOldPostedNews();
      results.push({
        task: 'Old News Entries',
        count: newsRemoved,
        icon: '🗑️',
      });
    } catch (error) {
      logger.error('News cleanup failed in all cleanup:', { error });
      results.push({
        task: 'Old News Entries',
        count: -1,
        icon: '❌',
      });
    }

    try {
      const rolesResult = await cleanupRoles(
        interaction.client,
        interaction.guildId,
      );
      const rolesTotal =
        rolesResult.orphanedMessages +
        rolesResult.invalidRoles +
        rolesResult.oldCooldowns;
      results.push({ task: 'Role System', count: rolesTotal, icon: '🎭' });
    } catch (error) {
      logger.error('Roles cleanup failed:', { error });
      results.push({ task: 'Role System', count: -1, icon: '❌' });
    }

    const totalRemoved = results
      .filter((r) => r.count > 0)
      .reduce((sum, r) => sum + r.count, 0);

    const embed = new EmbedBuilder()
      .setTitle('🧹 Cleanup Complete')
      .setColor(totalRemoved > 0 ? 0x5865f2 : 0x99aab5)
      .addFields(
        results.map((result) => ({
          name: `${result.icon} ${result.task}`,
          value:
            result.count === -1
              ? '❌ Failed'
              : result.count === 0
                ? 'None found'
                : `Removed ${result.count}`,
          inline: true,
        })),
      )
      .setFooter({
        text:
          totalRemoved > 0
            ? `Total items cleaned: ${totalRemoved}`
            : 'No items needed cleanup',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('All cleanup error:', { error });
    await interaction.editReply({
      content: '❌ Failed to run cleanup tasks due to an error.',
    });
  }
}
