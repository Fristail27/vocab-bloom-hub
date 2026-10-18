import type { StorybookConfig } from '@storybook/nextjs-vite';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],
  // The worker belongs only to the workshop, never to the admin's public assets.
  staticDirs: ['./public'],
  core: { disableTelemetry: true },
  env: (env) => ({ ...env, NEXT_PUBLIC_BASE_API_URL: '/__storybook/api' }),
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
      define: {
        'process.env.NEXT_PUBLIC_BASE_API_URL': JSON.stringify('/__storybook/api'),
        'process.env.API_INTERNAL_URL': JSON.stringify(''),
      },
    });
  },
};

export default config;
