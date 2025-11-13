import type { GuildMember, GuildMemberRoleManager } from 'discord.js';

/**
 * Type guard to check if an interaction member is a GuildMember
 * (as opposed to APIInteractionGuildMember)
 *
 * @param member - The member to check
 * @returns True if the member is a GuildMember with role management capabilities
 */
export function isGuildMember(
  member: unknown,
): member is GuildMember & { roles: GuildMemberRoleManager } {
  if (typeof member !== 'object' || member === null) {
    return false;
  }

  if (!('roles' in member)) {
    return false;
  }

  const memberObj = member as Record<string, unknown>;
  const roles = memberObj.roles;

  if (typeof roles !== 'object' || roles === null) {
    return false;
  }

  return 'cache' in roles;
}
