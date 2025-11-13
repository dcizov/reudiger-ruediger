import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'esnext',
  sourcemap: true,
  clean: true,
  minify: true,
  dts: true,
  splitting: false,
  noExternal: ['zod'],
  treeshake: true,
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
