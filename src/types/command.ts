import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

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
