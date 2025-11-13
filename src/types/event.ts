import type { ClientEvents } from 'discord.js';
import { z } from 'zod';

/**
 * Generic event handler type
 * Maps event name to correct parameter types from Discord.js
 */
export interface Event<
  EventName extends keyof ClientEvents = keyof ClientEvents,
> {
  name: EventName;
  once?: boolean;
  execute(...parameters: ClientEvents[EventName]): Promise<void> | void;
}

/**
 * Runtime validation schema for events
 */
export const eventSchema = z.object({
  name: z.string(),
  once: z.boolean().optional().default(false),
  execute: z.function(),
});

/**
 * Type predicate for event validation
 */
export const isValidEvent = (structure: unknown): structure is Event => {
  return eventSchema.safeParse(structure).success;
};
