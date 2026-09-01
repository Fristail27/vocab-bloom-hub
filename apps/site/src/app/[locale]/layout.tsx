import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { siteUrl } from '@/core/site';
import { isLocale, routing } from '@/i18n/routing';
import { LocaleParamsP } from '@/types/common';

import './globals.scss';

// every page is rendered at build time, per locale
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  // the social card defaults (issue #332): pages refine the og title and
  // description; the image comes from opengraph-image.tsx next to this file
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale,
    },
    twitter: { card: 'summary_large_image' },
  };
};

type RootLayoutP = Readonly<{ children: React.ReactNode }> & LocaleParamsP;

export default async function RootLayout({ children, params }: RootLayoutP) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="page">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
