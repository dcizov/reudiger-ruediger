import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // your bot entry point
  format: ['cjs', 'esm'], // commonjs for Node, esm for modern support
  target: 'node16', // Node.js runtime target matching your environment
  sourcemap: true, // generate source maps for debugging
  clean: true, // remove previous build outputs before new build
  minify: true, // minify output for smaller bundle size
  dts: true, // generate TypeScript declaration files
  splitting: false, // no code-splitting needed for Node apps
  external: [
    // exclude built-in Node modules and large deps if needed
    'discord.js',
    'pg',
    'express',
    'winston',
    'dotenv',
    'node-cron',
    // add other large external deps you want to keep out of bundle
  ],
  noExternal: ['zod'], // explicitly bundle some smaller libs if desired
  treeshake: true, // remove unused code
  esbuildOptions(options) {
    options.platform = 'node'; // ensure Node platform for correct polyfills
  },
});
