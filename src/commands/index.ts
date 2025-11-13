import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { z } from 'zod';
import type { StructurePredicate } from '../util/loaders.js';

/**
 * Standard command without subcommands
 */
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Command with subcommands (allows .addSubcommand() and .addSubcommandGroup())
 */
export interface SubcommandCommand {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Runtime validation schema for commands
 * Checks that a loaded module has required properties
 */
export const commandSchema = z.object({
  data: z.unknown(),
  execute: z.function(),
  autocomplete: z.function().optional(),
});

/**
 * Type predicate for command validation
 * Used by the dynamic loader to filter valid commands
 */
export const predicate: StructurePredicate<Command | SubcommandCommand> = (
  structure: unknown,
): structure is Command | SubcommandCommand => {
  return commandSchema.safeParse(structure).success;
};

/**
 * Legacy type guard (maintained for backwards compatibility)
 */
export const isValidCommand = predicate;
