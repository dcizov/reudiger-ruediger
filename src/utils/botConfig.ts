import { promises as fs } from "fs";
import path from "path";

export interface BotConfig {
  dealsChannelId: string;
  schedule: string; // e.g. "0 10 * * *"
}

const configPath = path.resolve(__dirname, "../data/config.json");

export async function getBotConfig(): Promise<BotConfig> {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data) as BotConfig;
  } catch {
    return { dealsChannelId: "", schedule: "0 10 * * *" }; // default: 10:00 every day
  }
}

export async function setBotConfig(config: BotConfig): Promise<void> {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function setDealsChannelId(channelId: string): Promise<void> {
  const config = await getBotConfig();
  config.dealsChannelId = channelId;
  await setBotConfig(config);
}

export async function setSchedule(schedule: string): Promise<void> {
  const config = await getBotConfig();
  config.schedule = schedule;
  await setBotConfig(config);
}
