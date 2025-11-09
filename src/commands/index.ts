import type { Command, SubcommandCommand } from '../types/command';
import { cleanup } from './cleanup';
import { compare } from './compare';
import { deal } from './deal';
import { help } from './help';
import { roles } from './roles';
import { setup } from './setup';
import { subscription } from './subscription';

export const commands: Record<string, Command | SubcommandCommand> = {
  setup,
  subscription,
  deal,
  cleanup,
  compare,
  help,
  roles,
};
