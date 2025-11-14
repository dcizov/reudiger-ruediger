import process from 'node:process';

import { runMigrations } from './db/index.js';
import { logger } from './util/logger.js';

/**
 * Standalone migration script for production deployments.
 *
 * Usage:
 *   npm run migrate
 *
 * This script should be run BEFORE starting the bot in production.
 * It ensures database schema is up-to-date before the application starts.
 */
async function main() {
  try {
    logger.info('🔄 Starting database migrations...');
    await runMigrations();
    logger.info('✅ Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed', { error });
    process.exit(1);
  }
}

void main();
