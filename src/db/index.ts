import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { config } from "config";

// Type the DATABASE_URL explicitly
const databaseUrl: string = config.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Type the connection explicitly
const conn: postgres.Sql = postgres(databaseUrl);

// Now drizzle should work without warnings
export const db = drizzle(conn, { schema });
