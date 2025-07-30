import type { Config } from "drizzle-kit";
import {config} from "./src/config";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: config.DATABASE_URL!,
  },
} satisfies Config;
