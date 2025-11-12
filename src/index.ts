import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags,
} from 'discord.js';

import { commands } from './commands';
import { env, isDev } from './config';
import {
  startDealScheduler,
  stopDealScheduler,
} from './services/schedulerService';
import { initializeDiscordLogger, logger } from './utils/logger';
import {
  checkUserRoleCooldown,
  getAllRolesInGuild,
  getReactionRoleButton,
  updateUserRoleCooldown,
  type ReactionRoleButton,
} from './utils/reactionRoles';
import { startWebhookServer } from './webhookServer';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

function handleReady(readyClient: Client<true>): void {
  logger.info(`✅ Discord bot is ready! Logged in as ${readyClient.user.tag}`);

  // Set bot status
  readyClient.user.setPresence({
    activities: [
      {
        name: '/help for commands',
        type: ActivityType.Playing,
      },
    ],
    status: 'online',
  });

  logger.info('🎮 Bot status set: Playing /help for commands');

  initializeDiscordLogger(client);
  void startDealScheduler(client);
}

client.once(Events.ClientReady, handleReady);

client.on(Events.InteractionCreate, (interaction: Interaction) => {
  void (async () => {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = commands[interaction.commandName];
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
        // Extract the actual buttonId by removing the prefix if needed
        let buttonId = interaction.customId;

        // Check if this is from /roles command
        const isRolesCommand = interaction.customId.startsWith('role_button_');

        if (isRolesCommand) {
          // Strip the 'role_button_' prefix to get the actual buttonId
          buttonId = interaction.customId.replace('role_button_', '');
        }

        const buttonData = await getReactionRoleButton(buttonId);

        if (!buttonData) {
          await interaction.reply({
            content: '❌ This role button is no longer valid.',
            ephemeral: true,
          });
          return;
        }

        if (!interaction.guild || !interaction.member) {
          await interaction.reply({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
          });
          return;
        }

        // Check cooldown for /roles command buttons
        if (isRolesCommand) {
          const cooldownCheck = await checkUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );
          if (!cooldownCheck.canChange) {
            await interaction.reply({
              content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
              ephemeral: true,
            });
            return;
          }

          // Check if role is required (can't be toggled off)
          if (buttonData.required) {
            await interaction.reply({
              content: '🔒 This role is required and cannot be removed.',
              ephemeral: true,
            });
            return;
          }
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
          await interaction.reply({
            content: '❌ Could not find your member data.',
            ephemeral: true,
          });
          return;
        }

        const role = interaction.guild.roles.cache.get(buttonData.roleId);
        if (!role) {
          await interaction.reply({
            content: '❌ This role no longer exists.',
            ephemeral: true,
          });
          return;
        }

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          await interaction.reply({
            content: `✅ Removed the **${role.name}** role from you.`,
            ephemeral: true,
          });
        } else {
          await member.roles.add(role);
          await interaction.reply({
            content: `✅ Gave you the **${role.name}** role!`,
            ephemeral: true,
          });
        }

        // Update cooldown for /roles command buttons
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
            ephemeral: true,
          })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      try {
        // Handle role select menu from /roles command
        if (interaction.customId.startsWith('role_select_')) {
          if (!interaction.guild || !interaction.member) {
            await interaction.reply({
              content: '❌ This command can only be used in a server.',
              ephemeral: true,
            });
            return;
          }

          // Check cooldown
          const cooldownCheck = await checkUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );
          if (!cooldownCheck.canChange) {
            await interaction.reply({
              content: `⏱️ Please wait ${cooldownCheck.remainingTime} minute(s) before changing roles again.`,
              ephemeral: true,
            });
            return;
          }

          const member = interaction.guild.members.cache.get(
            interaction.user.id,
          );
          if (!member) {
            await interaction.reply({
              content: '❌ Could not find your member data.',
              ephemeral: true,
            });
            return;
          }

          // Get all selected button IDs
          const selectedButtonIds = interaction.values;

          // Fetch all button data for this guild to get role IDs
          const allRoles = await getAllRolesInGuild(interaction.guild.id);

          // Map selected button IDs to role IDs
          const selectedRoleIds = new Set(
            allRoles
              .filter((r: ReactionRoleButton) =>
                selectedButtonIds.includes(r.buttonId),
              )
              .map((r: ReactionRoleButton) => r.roleId),
          );

          // Get roles that should be managed (exclude required roles)
          const managedRoles = allRoles.filter(
            (r: ReactionRoleButton) => !r.required,
          );

          // Determine which roles to add and remove
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

          // Apply role changes
          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd);
          }
          if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
          }

          // Update cooldown
          await updateUserRoleCooldown(
            interaction.user.id,
            interaction.guild.id,
          );

          // Build response message
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
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: changes.join('\n'),
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        logger.error('Error handling select menu interaction:', { error });
        await interaction
          .reply({
            content: '❌ An error occurred while updating your roles.',
            ephemeral: true,
          })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = commands[interaction.commandName];
      if (!command) return;

      // Guard against duplicate
      if (interaction.deferred || interaction.replied) {
        logger.debug('Interaction already processed', {
          commandName: interaction.commandName,
          interactionId: interaction.id,
        });
        return;
      }

      // ✅ DEFER IMMEDIATELY FOR ALL COMMANDS
      // This prevents timeout before reaching the handler
      const needsDefer = ['setup', 'compare', 'subscription'].includes(
        interaction.commandName,
      );

      if (needsDefer) {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (error) {
          logger.warn('Could not defer interaction:', {
            error,
            commandName: interaction.commandName,
          });
          return;
        }
      }

      try {
        await command.execute(interaction);

        if (interaction.commandName === 'setup') {
          void startDealScheduler(client);
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
  })();
});

if (!env.DISCORD_TOKEN) {
  logger.error('❌ DISCORD_TOKEN is missing from config.');
  process.exit(1);
}

client.login(env.DISCORD_TOKEN).catch((err: unknown) => {
  logger.error('❌ Failed to log in to Discord:', { error: err });
  process.exit(1);
});

// Graceful shutdown handlers
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received, shutting down gracefully...`);
  stopDealScheduler();
  await client.destroy();
  logger.info('✅ Bot shut down successfully');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Conditionally start webhook server
if (isDev || env.ENABLE_WEBHOOK_SERVER) {
  startWebhookServer();
}
