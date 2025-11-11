import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

import type { Command } from '../types/command';
import { logger } from '../utils/logger';
import {
  checkUserRoleCooldown,
  getAllRolesInGuild,
  groupRolesByCategory,
} from '../utils/reactionRoles';

export const roles: Command = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Manage your server roles'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (!interaction.guild || !interaction.member) {
        await interaction.editReply({
          content: '❌ This command can only be used in a server.',
        });
        return;
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownCheck = await checkUserRoleCooldown(userId, guildId);
      if (!cooldownCheck.canChange) {
        await interaction.editReply({
          content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
        });
        return;
      }

      // Fetch all roles configured for this guild
      const allRoles = await getAllRolesInGuild(guildId);

      if (allRoles.length === 0) {
        await interaction.editReply({
          content: '❌ No roles available to manage in this server.',
        });
        return;
      }

      // Get user's current roles
      const userRoles = allRoles.filter((roleButton) => {
        if (
          typeof interaction.member === 'object' &&
          interaction.member !== null &&
          'roles' in interaction.member &&
          typeof interaction.member.roles === 'object' &&
          interaction.member.roles !== null &&
          'cache' in interaction.member.roles
        ) {
          const rolesCache = interaction.member.roles.cache as Map<
            string,
            unknown
          >;
          return rolesCache.has(roleButton.roleId);
        }
        return false;
      });

      const hasAnyRole = userRoles.length > 0;
      const availableRoles = allRoles.filter((role) => {
        if (role.requiresExistingRoles && !hasAnyRole) {
          return false;
        }
        return true;
      });

      if (availableRoles.length === 0) {
        await interaction.editReply({
          content:
            '❌ No roles available. You may need to set up your initial roles first.',
        });
        return;
      }

      // Group roles by category
      const groupedRoles = groupRolesByCategory(availableRoles);

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('🎭 Manage Your Roles')
        .setDescription('Toggle roles on or off using the buttons below.')
        .setColor(0x5865f2)
        .setFooter({ text: '⏱️ Cooldown: 5 minutes between changes' });

      // Add fields for each category
      const fields: { name: string; value: string; inline: boolean }[] = [];
      for (const [category, categoryRoles] of groupedRoles) {
        const roleList = categoryRoles
          .map((role) => {
            const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
            const statusIcon = hasRole ? '✅' : '⬜';
            const lockIcon = role.required ? ' 🔒' : '';
            // Only show emoji and label, not duplicate status
            return `${statusIcon} ${role.emoji} **${role.label}**${lockIcon}`;
          })
          .join('\n');

        fields.push({
          name: `${category}`,
          value: roleList || 'No roles',
          inline: false,
        });
      }
      embed.addFields(fields);

      const components: ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >[] = [];

      if (availableRoles.length <= 5) {
        // Use buttons - simplified labels
        const buttons = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);

          return new ButtonBuilder()
            .setCustomId(`role_button_${role.buttonId}`)
            .setLabel(role.label) // Just the label, no emojis
            .setEmoji(role.emoji) // Use Discord's emoji field
            .setStyle(hasRole ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(role.required === true);
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons,
        );
        components.push(row);
      } else {
        // Use select menu
        const options = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
          return {
            label: role.label, // Just the label
            value: role.buttonId,
            description: role.category ?? 'Other',
            emoji: role.emoji, // Use Discord's emoji field
            default: hasRole,
          };
        });

        const nonRequiredCount = availableRoles.filter(
          (r) => !r.required,
        ).length;

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`role_select_${guildId}`)
          .setPlaceholder('Select your roles...')
          .setMinValues(0)
          .setMaxValues(nonRequiredCount > 0 ? nonRequiredCount : 1)
          .addOptions(options);

        const row =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu,
          );
        components.push(row);
      }

      await interaction.editReply({
        embeds: [embed],
        components: components,
      });
    } catch (err) {
      logger.error(
        `❌ Error in /roles command: ${err instanceof Error ? err.message : String(err)}`,
        { error: err },
      );

      const errorMessage =
        '❌ Failed to load roles. Please try again later or contact an administrator.';

      if (interaction.deferred) {
        await interaction
          .editReply({ content: errorMessage })
          .catch(() => null);
      } else {
        await interaction
          .reply({ content: errorMessage, ephemeral: true })
          .catch(() => null);
      }
    }
  },
};
