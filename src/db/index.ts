import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../config';
import * as schema from './schema';

const databaseUrl: string = env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const conn: postgres.Sql = postgres(databaseUrl);

export const db = drizzle(conn, { schema });
