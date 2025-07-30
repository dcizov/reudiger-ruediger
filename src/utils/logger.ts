import { type Client } from "discord.js";
import { getLogChannelId } from "./botConfig";

export async function logToAdmin(client: Client, content: string) {
  const logChannelId = await getLogChannelId();
  if (!logChannelId) return;

  const channel = await client.channels.fetch(logChannelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  await channel.send({ content }).catch(() => null);
}