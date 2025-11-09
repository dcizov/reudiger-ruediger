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
      // Ensure command is used in a guild
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

      // Get user's current roles from the reaction role system
      const userRoles = allRoles.filter((roleButton) => {
        // Check if member is a GuildMember (type guard)
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

      // Filter roles based on requiresExistingRoles logic
      const hasAnyRole = userRoles.length > 0;
      const availableRoles = allRoles.filter((role) => {
        // Exclude dev role if user has no roles yet
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
        .setTitle('Manage Your Roles')
        .setColor(0x5865f2) // Discord blurple
        .setFooter({ text: 'Cooldown: 5 minutes between changes' });

      // Add fields for each category
      const fields: { name: string; value: string; inline: boolean }[] = [];
      for (const [category, categoryRoles] of groupedRoles) {
        const roleList = categoryRoles
          .map((role) => {
            const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
            const indicator = hasRole ? '✅' : '⬜';
            const requiredTag = role.required ? ' 🔒' : '';
            return `${indicator} ${role.emoji} ${role.label}${requiredTag}`;
          })
          .join('\n');

        fields.push({
          name: category,
          value: roleList || 'No roles',
          inline: false,
        });
      }
      embed.addFields(fields);

      // Decide UI: buttons if ≤5 roles, select menu if >5 roles
      const components: ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >[] = [];

      if (availableRoles.length <= 5) {
        // Use buttons
        embed.setDescription(
          'Click the buttons below to toggle roles on or off.',
        );

        const buttons = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
          const label = hasRole
            ? `✅ ${role.emoji} ${role.label}`
            : `${role.emoji} ${role.label}`;

          return new ButtonBuilder()
            .setCustomId(`role_button_${role.buttonId}`)
            .setLabel(label)
            .setStyle(hasRole ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(role.required === true);
        });

        // Discord allows max 5 buttons per action row
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons,
        );
        components.push(row);
      } else {
        // Use select menu
        embed.setDescription(
          'Use the dropdown menu below to select your roles. You can select multiple roles at once.',
        );

        const options = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
          return {
            label: `${role.emoji} ${role.label}`,
            value: role.buttonId,
            description: role.category ?? 'Other',
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

      // Send the message with embed and components
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

      // Handle reply based on interaction state
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
