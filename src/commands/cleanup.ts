import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { cleanupExpiredDeals } from '../services/cleanupDeals';
import type { Command } from '../types/command';
import { logger } from '../utils/logger';

export const cleanup: Command = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Remove expired deals from the channel'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check if user has admin permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.editReply({
        content: 'You need to be an admin to use this command.',
      });
      return;
    }

    try {
      const removed = await cleanupExpiredDeals(interaction.client);
      await interaction.editReply(`🧹 Cleaned up ${removed} expired deal(s).`);
    } catch (err) {
      logger.error('Cleanup error:', { error: err });
      await interaction.editReply('Failed to cleanup deals due to an error.');
    }
  },
};
