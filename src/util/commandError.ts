import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';

import { logger } from './logger.js';

/**
 * Handle command errors consistently across all commands
 * Logs the error and sends a user-friendly message
 *
 * @param interaction - The Discord interaction that errored
 * @param error - The error that occurred
 * @param userMessage - Optional custom user-facing error message
 */
export async function handleCommandError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
  userMessage = '❌ An error occurred while processing your request. Please try again later.',
): Promise<void> {
  // Log the error with context
  logger.error('Command error', {
    error,
    commandName: interaction.commandName,
    subcommand: interaction.options.getSubcommand(false),
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  // Send user-friendly error message
  try {
    if (interaction.deferred || interaction.replied) {
      // If already deferred or replied, use editReply or followUp
      if (interaction.deferred) {
        await interaction.editReply(userMessage);
      } else {
        await interaction.followUp({
          content: userMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      // If not yet replied, use reply
      await interaction.reply({
        content: userMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    // If we can't send the error message, log it but don't throw
    logger.debug('Could not send error message to user', {
      error: replyError,
      commandName: interaction.commandName,
    });
  }
}
