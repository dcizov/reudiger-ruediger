import type { Client } from 'discord.js';
import { eq, lt } from 'drizzle-orm';

import { db } from '../db';
import {
  reactionRoleButtons,
  reactionRoles,
  userRoleCooldowns,
} from '../db/schema';
import { logger } from '../utils/logger';

interface RoleCleanupResult {
  orphanedMessages: number;
  invalidRoles: number;
  oldCooldowns: number;
}

/**
 * Clean up orphaned role messages (deleted from Discord but still in DB)
 */
async function cleanupOrphanedRoleMessages(
  client: Client,
  guildId: string,
): Promise<number> {
  const roleMessages = await db
    .select()
    .from(reactionRoles)
    .where(eq(reactionRoles.guildId, guildId));

  let removed = 0;

  for (const roleMessage of roleMessages) {
    try {
      const channel = await client.channels.fetch(roleMessage.channelId);

      if (!channel || !('messages' in channel)) {
        await db
          .delete(reactionRoles)
          .where(eq(reactionRoles.messageId, roleMessage.messageId));
        removed++;
        logger.debug('Removed role message (channel not found)', {
          messageId: roleMessage.messageId,
          channelId: roleMessage.channelId,
        });
        continue;
      }

      try {
        await channel.messages.fetch(roleMessage.messageId);
      } catch {
        await db
          .delete(reactionRoles)
          .where(eq(reactionRoles.messageId, roleMessage.messageId));
        removed++;
        logger.debug('Removed orphaned role message', {
          messageId: roleMessage.messageId,
        });
      }
    } catch (error) {
      logger.debug('Error checking role message', {
        messageId: roleMessage.messageId,
        error,
      });
    }
  }

  return removed;
}

/**
 * Clean up buttons referencing deleted Discord roles
 */
async function cleanupInvalidRoleButtons(
  client: Client,
  guildId: string,
): Promise<number> {
  const roleMessages = await db
    .select()
    .from(reactionRoles)
    .where(eq(reactionRoles.guildId, guildId));

  if (roleMessages.length === 0) return 0;

  const guild = await client.guilds.fetch(guildId);
  if (!guild) return 0;

  let removed = 0;

  for (const roleMessage of roleMessages) {
    const buttons = await db
      .select()
      .from(reactionRoleButtons)
      .where(eq(reactionRoleButtons.messageId, roleMessage.messageId));

    for (const button of buttons) {
      try {
        await guild.roles.fetch(button.roleId);
      } catch {
        await db
          .delete(reactionRoleButtons)
          .where(eq(reactionRoleButtons.id, button.id));
        removed++;
        logger.debug('Removed button for deleted role', {
          buttonId: button.buttonId,
          roleId: button.roleId,
        });
      }
    }
  }

  return removed;
}

/**
 * Clean up old cooldown entries (older than 30 days)
 */
async function cleanupOldCooldowns(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .delete(userRoleCooldowns)
    .where(lt(userRoleCooldowns.lastChanged, thirtyDaysAgo));

  const deleted = result.length;

  if (deleted > 0) {
    logger.debug(`Cleaned up ${deleted} old role cooldown entries`);
  }

  return deleted;
}

/**
 * Run all role cleanup tasks
 */
export async function cleanupRoles(
  client: Client,
  guildId: string,
): Promise<RoleCleanupResult> {
  const orphanedMessages = await cleanupOrphanedRoleMessages(client, guildId);
  const invalidRoles = await cleanupInvalidRoleButtons(client, guildId);
  const oldCooldowns = await cleanupOldCooldowns();

  return {
    orphanedMessages,
    invalidRoles,
    oldCooldowns,
  };
}
