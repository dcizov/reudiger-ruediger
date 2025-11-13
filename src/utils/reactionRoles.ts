import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../db';
import {
  reactionRoleButtons,
  reactionRoles,
  userRoleCooldowns,
} from '../db/schema';

type ReactionRoleButton = typeof reactionRoleButtons.$inferSelect;

export async function addReactionRoleMessage(
  messageId: string,
  channelId: string,
  guildId: string,
): Promise<void> {
  await db.insert(reactionRoles).values({
    messageId,
    channelId,
    guildId,
  });
}

export async function addReactionRoleButton(
  messageId: string,
  roleId: string,
  emoji: string,
  label: string,
  buttonId: string,
): Promise<void> {
  await db.insert(reactionRoleButtons).values({
    messageId,
    roleId,
    emoji,
    label,
    buttonId,
  });
}

export async function getReactionRoleButton(
  buttonId: string,
): Promise<ReactionRoleButton | undefined> {
  return await db.query.reactionRoleButtons.findFirst({
    where: eq(reactionRoleButtons.buttonId, buttonId),
  });
}

export async function deleteReactionRoleMessage(
  messageId: string,
): Promise<void> {
  await db
    .delete(reactionRoleButtons)
    .where(eq(reactionRoleButtons.messageId, messageId));
  await db.delete(reactionRoles).where(eq(reactionRoles.messageId, messageId));
}

/**
 * Get all reaction role buttons for a guild
 * Fetches all role messages in the guild and their associated buttons
 */
export async function getAllRolesInGuild(
  guildId: string,
): Promise<ReactionRoleButton[]> {
  const messages = await db.query.reactionRoles.findMany({
    where: eq(reactionRoles.guildId, guildId),
  });

  if (messages.length === 0) {
    return [];
  }

  const messageIds = messages.map((m) => m.messageId);
  const buttons = await db.query.reactionRoleButtons.findMany({
    where: inArray(reactionRoleButtons.messageId, messageIds),
  });

  return buttons;
}

/**
 * Check if a user can change roles (cooldown check)
 * Returns an object with { canChange: boolean, remainingTime?: number }
 */
export async function checkUserRoleCooldown(
  userId: string,
  guildId: string,
): Promise<{ canChange: boolean; remainingTime?: number }> {
  const cooldownMinutes = 5;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  const record = await db.query.userRoleCooldowns.findFirst({
    where: and(
      eq(userRoleCooldowns.userId, userId),
      eq(userRoleCooldowns.guildId, guildId),
    ),
  });

  if (!record) {
    return { canChange: true };
  }

  const timeSinceLastChange = Date.now() - record.lastChanged.getTime();

  if (timeSinceLastChange >= cooldownMs) {
    return { canChange: true };
  }

  const remainingTime = Math.ceil(
    (cooldownMs - timeSinceLastChange) / 1000 / 60,
  );
  return { canChange: false, remainingTime };
}

/**
 * Update the user's role change cooldown timestamp
 */
export async function updateUserRoleCooldown(
  userId: string,
  guildId: string,
): Promise<void> {
  const existing = await db.query.userRoleCooldowns.findFirst({
    where: and(
      eq(userRoleCooldowns.userId, userId),
      eq(userRoleCooldowns.guildId, guildId),
    ),
  });

  if (existing) {
    await db
      .update(userRoleCooldowns)
      .set({ lastChanged: new Date() })
      .where(
        and(
          eq(userRoleCooldowns.userId, userId),
          eq(userRoleCooldowns.guildId, guildId),
        ),
      );
  } else {
    await db.insert(userRoleCooldowns).values({
      userId,
      guildId,
      lastChanged: new Date(),
    });
  }
}

/**
 * Group roles by category for organized display
 * Returns a Map of category name to roles in that category
 */
export function groupRolesByCategory(
  roles: ReactionRoleButton[],
): Map<string, ReactionRoleButton[]> {
  const grouped = new Map<string, ReactionRoleButton[]>();

  for (const role of roles) {
    const category = role.category ?? 'Other';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(role);
  }

  return grouped;
}

export type { ReactionRoleButton };
