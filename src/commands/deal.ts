import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { postNewDeals } from '../services/postNewDeals.js';
import type { Command } from './index.js';
import { logger } from '../util/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deal')
    .setDescription('Admin: Manually trigger deal posting (bypasses schedule)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const posted = await postNewDeals(interaction.client, 5);
      if (posted > 0) {
        await interaction.editReply(
          `✅ Manually posted ${posted} new deal(s) in the configured channel.`,
        );
      } else {
        await interaction.editReply(
          '📭 No new quality deals found at this time.\n\n**Possible reasons:**\n• All current deals already posted\n• No deals meet quality filters (≥70% off)\n• Try again in a few hours',
        );
      }
    } catch (err) {
      logger.error(
        `❌ Error in /deal command: ${err instanceof Error ? err.message : String(err)}`,
        { error: err },
      );
      await interaction.editReply(
        '❌ Failed to post deals. Check bot permissions in the deals channel.',
      );
    }
  },
} satisfies Command;
