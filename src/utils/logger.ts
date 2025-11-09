import type { Client } from 'discord.js';
import winston from 'winston';

import { env } from '../config';
import { DiscordTransport } from './discordTransport';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format for console output
 * Format: [YYYY-MM-DD HH:mm:ss] LEVEL: message {metadata}
 */
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `[${String(timestamp)}] ${String(level)}: ${String(message)}`;

  // Add metadata if present (excluding internal Winston fields)
  const metaKeys = Object.keys(metadata).filter(
    (key) =>
      ![
        'level',
        'message',
        'timestamp',
        'splat',
        'Symbol(level)',
        'Symbol(message)',
      ].includes(key),
  );

  if (metaKeys.length > 0) {
    const metaObj: Record<string, unknown> = {};
    for (const key of metaKeys) {
      metaObj[key] = metadata[key];
    }
    msg += ` ${JSON.stringify(metaObj)}`;
  }

  return msg;
});

/**
 * Discord transport instance (client will be set later)
 */
const discordTransport = new DiscordTransport({
  minLevel: 'warn', // Only send warn and error to Discord
});

/**
 * Main Winston logger instance
 * Configured with:
 * - Console transport (respects LOG_LEVEL from env)
 * - Discord transport (sends warn/error to Discord channel when configured)
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    errors({ stack: true }), // Include stack traces for errors
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),
    // Discord transport (client set after bot ready)
    discordTransport,

    // Optional: File transport for production (uncomment to enable)
    // new winston.transports.File({
    //   filename: 'logs/error.log',
    //   level: 'error',
    //   format: combine(timestamp(), json()),
    // }),
    // new winston.transports.File({
    //   filename: 'logs/combined.log',
    //   format: combine(timestamp(), json()),
    // }),
  ],
});

/**
 * Initialize Discord transport with client (call after bot is ready)
 */
export function initializeDiscordLogger(client: Client): void {
  discordTransport.setClient(client);
  logger.info('Discord logger initialized');
}

/**
 * Legacy compatibility: logToAdmin function for gradual migration
 * @deprecated Use logger.warn() or logger.error() instead
 */
export function logToAdmin(_client: Client, content: string): void {
  logger.warn(content);
}
