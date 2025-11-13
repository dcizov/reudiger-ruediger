import { URL } from 'node:url';
import { Events, MessageFlags, type Interaction } from 'discord.js';

import { startDealScheduler } from '../services/schedulerService.js';
import type { Event } from './index.js';
import { loadCommands } from '../util/loaders.js';
import { logger } from '../util/logger.js';
import {
  checkUserRoleCooldown,
  getAllRolesInGuild,
  getReactionRoleButton,
  updateUserRoleCooldown,
  type ReactionRoleButton,
} from '../util/reactionRoles.js';

const commands = await loadCommands(new URL('../commands/', import.meta.url));

logger.info(
  `📦 Loaded ${commands.size} commands: ${[...commands.keys()].join(', ')}`,
);

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error(
            `Error during autocomplete: ${interaction.commandName}`,
            { error },
          );
        }
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        let buttonId = interaction.customId;
        const isRolesCommand = interaction.customId.startsWith('role_button_');

        if (isRolesCommand) {
          buttonId = interaction.customId.replace('role_button_', '');
        }

        const buttonData = await getReactionRoleButton(buttonId);

        if (!buttonData) {
          await interaction.reply({
            content: '❌ This role button is no longer valid.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!interaction.guild || !interaction.member) {
          await interaction.reply({
            content: '❌ This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (isRolesCommand) {
          const cooldownCheck = await checkUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );
          if (!cooldownCheck.canChange) {
            await interaction.reply({
              content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (buttonData.required) {
            await interaction.reply({
              content: '🔒 This role is required and cannot be removed.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
          await interaction.reply({
            content: '❌ Could not find your member data.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const role = interaction.guild.roles.cache.get(buttonData.roleId);
        if (!role) {
          await interaction.reply({
            content: '❌ This role no longer exists.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          await interaction.reply({
            content: `✅ Removed the **${role.name}** role from you.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await member.roles.add(role);
          await interaction.reply({
            content: `✅ Gave you the **${role.name}** role!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (isRolesCommand) {
          await updateUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );
        }
      } catch (error) {
        logger.error('Error handling button interaction:', { error });
        await interaction
          .reply({
            content: '❌ An error occurred while toggling your role.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId.startsWith('role_select_')) {
          if (!interaction.guild || !interaction.member) {
            await interaction.reply({
              content: '❌ This command can only be used in a server.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const cooldownCheck = await checkUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );
          if (!cooldownCheck.canChange) {
            await interaction.reply({
              content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const member = interaction.guild.members.cache.get(
            interaction.user.id,
          );
          if (!member) {
            await interaction.reply({
              content: '❌ Could not find your member data.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const selectedButtonIds = interaction.values;
          const allRoles = await getAllRolesInGuild(interaction.guild.id);

          const selectedRoleIds = new Set(
            allRoles
              .filter((r: ReactionRoleButton) =>
                selectedButtonIds.includes(r.buttonId),
              )
              .map((r: ReactionRoleButton) => r.roleId),
          );

          const managedRoles = allRoles.filter(
            (r: ReactionRoleButton) => !r.required,
          );

          const rolesToAdd: string[] = [];
          const rolesToRemove: string[] = [];

          for (const roleButton of managedRoles) {
            const hasRole = member.roles.cache.has(roleButton.roleId);
            const shouldHave = selectedRoleIds.has(roleButton.roleId);

            if (shouldHave && !hasRole) {
              rolesToAdd.push(roleButton.roleId);
            } else if (!shouldHave && hasRole) {
              rolesToRemove.push(roleButton.roleId);
            }
          }

          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd);
          }
          if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
          }

          await updateUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );

          const changes: string[] = [];
          if (rolesToAdd.length > 0) {
            const addedRoleNames = rolesToAdd
              .map((id) => interaction.guild!.roles.cache.get(id)?.name)
              .filter(Boolean)
              .join(', ');
            changes.push(`✅ Added: **${addedRoleNames}**`);
          }
          if (rolesToRemove.length > 0) {
            const removedRoleNames = rolesToRemove
              .map((id) => interaction.guild!.roles.cache.get(id)?.name)
              .filter(Boolean)
              .join(', ');
            changes.push(`❌ Removed: **${removedRoleNames}**`);
          }

          if (changes.length === 0) {
            await interaction.reply({
              content:
                '✅ No changes needed - your roles are already up to date.',
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await interaction.reply({
              content: changes.join('\n'),
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (error) {
        logger.error('Error handling select menu interaction:', { error });
        await interaction
          .reply({
            content: '❌ An error occurred while updating your roles.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Command not found: ${interaction.commandName}`);
        return;
      }

      if (interaction.deferred || interaction.replied) {
        logger.debug('Interaction already processed', {
          commandName: interaction.commandName,
          interactionId: interaction.id,
        });
        return;
      }

      try {
        await command.execute(interaction);

        if (interaction.commandName === 'setup') {
          await startDealScheduler(interaction.client);
        }
      } catch (error) {
        logger.error(`❌ Error executing command ${interaction.commandName}:`, {
          error,
          commandName: interaction.commandName,
        });

        try {
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
              content: 'There was an error executing this command!',
            });
          } else if (interaction.replied) {
            await interaction.followUp({
              content: 'There was an error executing this command!',
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await interaction.reply({
              content: 'There was an error executing this command!',
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (replyError) {
          logger.debug('Could not send error message to user:', {
            error: replyError,
            commandName: interaction.commandName,
          });
        }
      }
    }
  },
} satisfies Event<Events.InteractionCreate>;
