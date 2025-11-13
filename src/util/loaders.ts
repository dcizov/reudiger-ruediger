import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

import type { Command, SubcommandCommand } from '../commands/index.js';
import { isValidCommand } from '../commands/index.js';
import type { Event } from '../events/index.js';
import { isValidEvent } from '../events/index.js';

type PathLike = string | URL;

/**
 * Type predicate function that validates if a structure matches expected shape
 */
export type StructurePredicate<Structure> = (
  structure: unknown,
) => structure is Structure;

/**
 * Generic loader for dynamically importing and validating modules
 * @param dir - Directory to search for modules
 * @param predicate - Validation function for loaded structures
 * @param recursive - Whether to search subdirectories (default: true)
 * @returns Array of validated structures
 */
export async function loadStructures<Structure>(
  dir: PathLike,
  predicate: StructurePredicate<Structure>,
  recursive = true,
): Promise<Structure[]> {
  const statDir = await stat(dir);
  const basePath = dir instanceof URL ? fileURLToPath(dir) : dir.toString();

  if (!statDir.isDirectory()) {
    throw new Error(`The directory '${basePath}' is not a directory.`);
  }

  const structures: Structure[] = [];

  const extension = process.env.NODE_ENV === 'production' ? 'js' : 'ts';
  const pattern = resolve(
    basePath,
    recursive ? `**/*.${extension}` : `*.${extension}`,
  );

  const files = await glob(pattern);

  for (const file of files) {
    if (file.endsWith(`/index.${extension}`)) {
      continue;
    }

    try {
      const fileUrl = `file://${file}`;
      const imported = (await import(fileUrl)) as Record<string, unknown>;

      let structure: unknown = imported.default;

      if (!structure) {
        const exportKeys = Object.keys(imported).filter(
          (key) => key !== 'default',
        );
        if (exportKeys.length === 1) {
          const key = exportKeys[0];
          if (key) {
            structure = imported[key];
          }
        } else if (exportKeys.length > 1) {
          const fileName =
            file
              .split('/')
              .pop()
              ?.replace(/\.(ts|js)$/, '') ?? '';
          const firstKey = exportKeys[0] ?? '';
          structure = imported[fileName] ?? imported[firstKey];
        }
      }

      if (structure && predicate(structure)) {
        structures.push(structure);
      } else {
        console.warn(`⚠️ Skipping invalid structure in ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error loading ${file}:`, error);
    }
  }

  return structures;
}

/**
 * Load commands from directory and return as Map for O(1) lookup
 * @param dir - Commands directory path
 * @param recursive - Search subdirectories (default: true)
 * @returns Map of command name to command object
 */
export async function loadCommands(
  dir: PathLike,
  recursive = true,
): Promise<Map<string, Command | SubcommandCommand>> {
  const commands = await loadStructures<Command | SubcommandCommand>(
    dir,
    isValidCommand,
    recursive,
  );

  const commandMap = new Map<string, Command | SubcommandCommand>();

  for (const command of commands) {
    let commandName: string | undefined;

    if ('name' in command.data && typeof command.data.name === 'string') {
      commandName = command.data.name;
    } else if (
      'toJSON' in command.data &&
      typeof command.data.toJSON === 'function'
    ) {
      const json = command.data.toJSON() as { name?: string };
      commandName = json.name;
    }

    if (commandName) {
      commandMap.set(commandName, command);
    }
  }

  return commandMap;
}

/**
 * Load events from directory
 * @param dir - Events directory path
 * @param recursive - Search subdirectories (default: true)
 * @returns Array of event handlers
 */
export async function loadEvents(
  dir: PathLike,
  recursive = true,
): Promise<Event[]> {
  return loadStructures(dir, isValidEvent, recursive);
}
