import { defineConfig } from 'tsup';

// ESM + CJS builds with declarations; no runtime dependencies, fetch only
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'neutral',
  treeshake: true,
});
