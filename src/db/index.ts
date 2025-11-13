import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '../config.js';
import * as schema from './schema.js';

const databaseUrl: string = env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  delay = 2000,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;

      if (isLastAttempt) {
        throw error;
      }

      console.log(
        `⚠️  Connection failed (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached');
}

export async function runMigrations() {
  console.log('⏳ Running database migrations...');

  const migrationClient = postgres(databaseUrl, { max: 1 });

  try {
    await retry(async () => {
      await migrate(drizzle(migrationClient), {
        migrationsFolder: './drizzle',
      });
    });

    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

const conn: postgres.Sql = postgres(databaseUrl);

export const db = drizzle(conn, { schema });
