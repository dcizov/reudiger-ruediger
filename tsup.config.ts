import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node16',
  sourcemap: true,
  clean: true,
  minify: true,
  dts: true,
  splitting: false,
  external: ['discord.js', 'pg', 'express', 'winston', 'dotenv', 'node-cron'],
  noExternal: ['zod'],
  treeshake: true,
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
