import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "./schema.js";

export type DealDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseHandle {
  db: DealDatabase;
  close(): Promise<void>;
}

/** Creating the handle is lazy; this function does not run migrations. */
export function createDatabase(databaseUrl: string): DatabaseHandle {
  if (!databaseUrl.trim()) {
    throw new Error("DATABASE_URL is required to enable deal persistence");
  }

  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return {
    db: drizzle(sql, { schema }),
    close: () => sql.end({ timeout: 5 }),
  };
}
