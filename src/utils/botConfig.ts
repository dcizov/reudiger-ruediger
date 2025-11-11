import { eq } from 'drizzle-orm';

import { db } from '../db/index';
import { botConfig } from '../db/schema';

export interface BotConfig {
  dealsChannelId: string;
  schedule: string;
}

export async function getBotConfig(): Promise<BotConfig> {
  const rows = await db.select().from(botConfig);
  const config: BotConfig = {
    dealsChannelId: '',
    schedule: '*/30 * * * *',
  };
  for (const row of rows) {
    if (row.key === 'dealsChannelId') config.dealsChannelId = row.value;
    if (row.key === 'schedule') config.schedule = row.value;
  }
  return config;
}

export async function setConfigValue(
  key: string,
  value: string,
): Promise<void> {
  await db
    .insert(botConfig)
    .values({ key, value })
    .onConflictDoUpdate({
      target: botConfig.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function setDealsChannelId(channelId: string): Promise<void> {
  await setConfigValue('dealsChannelId', channelId);
}

export async function setSchedule(schedule: string): Promise<void> {
  await setConfigValue('schedule', schedule);
}

export async function setLogChannelId(channelId: string): Promise<void> {
  await db
    .insert(botConfig)
    .values({ key: 'logChannelId', value: channelId })
    .onConflictDoUpdate({ target: botConfig.key, set: { value: channelId } });
}

export async function getLogChannelId(): Promise<string | null> {
  const row = await db.query.botConfig.findFirst({
    where: eq(botConfig.key, 'logChannelId'),
  });
  return row?.value ?? null;
}
