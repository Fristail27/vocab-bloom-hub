import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import {
  useRouter,
  usePathname,
  useParams,
  useSearchParams,
  ReadonlyURLSearchParams,
} from '@storybook/nextjs-vite/navigation.mock';
import { configure, fn } from 'storybook/test';
import { App, ConfigProvider, theme } from 'antd';
import { NextIntlClientProvider } from 'next-intl';
import { setupWorker } from 'msw/browser';
import { HttpNetworkFrame } from 'msw/experimental';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { localeDirection } from '../src/i18n/direction';
import { createDatasetScenario } from '../stories/mocks/datasets';
import { catalogs } from './catalogs';
import '../src/app/[locale]/globals.css';

const preview: Preview = {
  globalTypes: {
    locale: {
      toolbar: { icon: 'globe', dynamicTitle: true, items: Object.keys(catalogs) },
    },
    theme: { toolbar: { icon: 'paintbrush', items: ['light', 'dark'], dynamicTitle: true } },
  },
  initialGlobals: { locale: 'en', theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      // Storybook 10.6's AppRouterProvider predates Next 16.4's parentRenderTree.
      // Use the supported navigation mocks below until that provider catches up.
      appDirectory: false,
    },
  },
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker();
      await worker.start({
        quiet: true,
        onUnhandledFrame({ frame, defaults }) {
          // Fail closed for every API request, including an accidentally configured real origin.
          if (
            frame instanceof HttpNetworkFrame &&
            /^\/(?:__storybook\/)?api(?:\/|$)/.test(new URL(frame.data.request.url).pathname)
          )
            defaults.error();
        },
      });
      return worker;
    }),
  ],
  beforeEach(context) {
    configure({ asyncUtilTimeout: 5000 });
    const locale = context.globals.locale ?? 'en';
    useRouter.mockReturnValue({
      back: fn(),
      forward: fn(),
      refresh: fn(),
      push: fn(),
      replace: fn(),
      prefetch: fn(),
      bfcacheId: 'storybook',
    });
    usePathname.mockReturnValue(`/${locale}/managing/datasets`);
    useParams.mockReturnValue({ locale: String(locale) });
    useSearchParams.mockReturnValue(new ReadonlyURLSearchParams());
    // New in-memory state for every story/replay; no shared mutable fixtures.
    context.msw.use(...createDatasetScenario(context.parameters.datasetScenario));
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale as keyof typeof catalogs;
      const direction = localeDirection(locale);
      const dark = context.globals.theme === 'dark';
      return (
        <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
          <ConfigProvider
            direction={direction}
            theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}
          >
            <App>
              <div
                data-story-id={context.id}
                dir={direction}
                style={{ padding: 24, minHeight: '100vh', background: dark ? '#141414' : '#fff' }}
              >
                <Story key={`${context.id}-${locale}-${dark}`} />
              </div>
            </App>
          </ConfigProvider>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
