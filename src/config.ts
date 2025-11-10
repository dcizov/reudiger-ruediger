import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'Discord token is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'Discord guild ID is required'),
  ITAD_API_KEY: z.string().min(1, 'ITAD API key is required'),
  DATABASE_URL: z.url('DATABASE_URL must be a valid URL'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  WEBHOOK_PORT: z
    .string()
    .regex(/^\d+$/, 'WEBHOOK_PORT must be a valid port number')
    .optional()
    .transform((val) => (val ? Number(val) : 3001)),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  ENABLE_WEBHOOK_SERVER: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .default(false),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(z.treeifyError(parsed.error));
    process.exit(1);
  }

  return parsed.data;
}

export const env = validateEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
