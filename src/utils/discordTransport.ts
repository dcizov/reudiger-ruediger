import type { Client } from 'discord.js';
import Transport from 'winston-transport';

import { getLogChannelId } from './botConfig';

interface DiscordTransportOptions extends Transport.TransportStreamOptions {
  client?: Client;
  minLevel?: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Custom Winston transport that sends log messages to a configured Discord channel
 * Only sends messages at or above the configured minLevel (default: warn)
 */
export class DiscordTransport extends Transport {
  private client: Client | null = null;
  private minLevel: string;

  constructor(opts: DiscordTransportOptions = {}) {
    super(opts);
    this.client = opts.client ?? null;
    this.minLevel = opts.minLevel ?? 'warn';
  }

  /**
   * Set the Discord client (called after bot is ready)
   */
  setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Winston transport log method
   */
  async log(
    info: { level: string; message: string },
    callback: () => void,
  ): Promise<void> {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Skip if client not initialized
    if (!this.client) {
      callback();
      return;
    }

    // Filter by log level (only send error and warn by default)
    const levelPriority: Record<string, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    const currentPriority = levelPriority[info.level] ?? 999;
    const minPriority = levelPriority[this.minLevel] ?? 999;

    if (currentPriority > minPriority) {
      callback();
      return;
    }

    try {
      const logChannelId = await getLogChannelId();
      if (!logChannelId) {
        callback();
        return;
      }

      const channel = await this.client.channels
        .fetch(logChannelId)
        .catch(() => null);
      if (!channel || !('send' in channel)) {
        callback();
        return;
      }

      // Format message with emoji based on level
      const emoji =
        info.level === 'error' ? '🔴' : info.level === 'warn' ? '⚠️' : 'ℹ️';
      const formattedMessage = `${emoji} **[${info.level.toUpperCase()}]** ${info.message}`;

      await channel.send({ content: formattedMessage }).catch(() => null);
    } catch {
      // Silently fail - Discord logging is not critical
    }

    callback();
  }
}
