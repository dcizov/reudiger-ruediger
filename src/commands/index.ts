import type { Command } from "../types/command";
import { cleanup } from "./cleanup";
import { compare } from "./compare";
import { deal } from "./deal";
import { help } from "./help";
import { notify } from "./notify";
import { setup } from "./setup";
import { subscribe } from "./subscribe";
import { subscriptionsList } from "./subscriptions";
import { unsubscribe } from "./unsubscribe";
import { unsubscribeAll } from "./unsubscribeAll";
import { updateThreshold } from "./updateThreshold";

export const commands: { [commandName: string]: Command } = {
  setup,
  deal,
  cleanup,
  compare,
  subscribe,
  unsubscribe,
  unsubscribe_all: unsubscribeAll,
  subscriptions: subscriptionsList,
  notify,
  update_threshold: updateThreshold,
  help,
};
