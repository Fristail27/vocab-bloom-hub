import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { isLocale, routing } from '@/i18n/routing';
import { LocaleParamsP } from '@/types/common';

import './globals.scss';

// every page is rendered at build time, per locale
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
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
