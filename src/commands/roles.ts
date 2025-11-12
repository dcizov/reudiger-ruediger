import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (!interaction.guild || !interaction.member) {
        await interaction.editReply({
          content: '❌ This command can only be used in a server.',
        });
        return;
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const cooldownCheck = await checkUserRoleCooldown(userId, guildId);
      if (!cooldownCheck.canChange) {
        await interaction.editReply({
          content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
        });
        return;
      }

      const allRoles = await getAllRolesInGuild(guildId);

      if (allRoles.length === 0) {
        await interaction.editReply({
          content: '❌ No roles available to manage in this server.',
        });
        return;
      }

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

      const groupedRoles = groupRolesByCategory(availableRoles);

      const embed = new EmbedBuilder()
        .setTitle('🎭 Manage Your Roles')
        .setDescription(
          'Select the roles you want by clicking the buttons below.\nGreen buttons = roles you have\nGray buttons = roles you can get',
        )
        .setColor(0x5865f2);

      const fields: { name: string; value: string; inline: boolean }[] = [];
      for (const [category, categoryRoles] of groupedRoles) {
        const roleList = categoryRoles
          .map((role) => {
            const lockIcon = role.required ? ' 🔒' : '';
            return `${role.emoji} **${role.label}**${lockIcon}`;
          })
          .join('\n');

        fields.push({
          name: category,
          value: roleList || 'No roles',
          inline: false,
        });
      }
      embed.addFields(fields);
      embed.setFooter({
        text: '⏱️ You can change roles once every 5 minutes',
      });

      const components: ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >[] = [];

      if (availableRoles.length <= 5) {
        const buttons = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);

          return new ButtonBuilder()
            .setCustomId(`role_button_${role.buttonId}`)
            .setLabel(role.label)
            .setEmoji(role.emoji)
            .setStyle(hasRole ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(role.required === true);
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons,
        );
        components.push(row);
      } else {
        const options = availableRoles.map((role) => {
          const hasRole = userRoles.some((ur) => ur.roleId === role.roleId);
          return {
            label: role.label,
            value: role.buttonId,
            description: role.category ?? 'Other',
            emoji: role.emoji,
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
          .reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
          .catch(() => null);
      }
    }
  },
};
