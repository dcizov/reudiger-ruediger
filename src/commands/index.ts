import type { Command } from "../types/command";
import { deal } from "./deal";
import { ping } from "./ping";
import { setup } from "./setup";

export const commands: Record<string, Command> = {
  ping,
  setup,
  deal,
} as const;
