'use client';

import React, { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Pronounce } from '@/components/Pronounce';

import styles from '../../word.module.scss';
import { ipa } from './Entry';

// URL navigation asks the server for just the selected panel, including its
// metadata. Unselected dictionaries are neither rendered nor prefetched.
type DatasetPanelsP = {
  tabs: { dataset: string; title: string }[];
  selected: string;
  headline: { word: string; transcription: string | null };
  children: React.ReactNode;
};

const tabId = (dataset: string): string => `dataset-tab-${dataset}`;
const panelId = (dataset: string): string => `dataset-panel-${dataset}`;

export const DatasetPanels = ({ tabs, selected, headline, children }: DatasetPanelsP) => {
  const t = useTranslations('word');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const select = (dataset: string) => {
    if (dataset === selected) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set('dataset', dataset);
    startTransition(() => {
      router.push(`${pathname}?${query}${window.location.hash}`, { scroll: false });
    });
  };

  // Arrow keys follow the writing direction; focus stays on the tab while
  // the transition replaces its panel. The selected state describes the
  // content actually on screen until that navigation finishes.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = getComputedStyle(event.currentTarget).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    const index = tabs.findIndex((tab) => tabId(tab.dataset) === document.activeElement?.id);
    const next = {
      [forward]: (index + 1) % tabs.length,
      [back]: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[next].dataset);
    document.getElementById(tabId(tabs[next].dataset))?.focus();
  };

  const tabbed = tabs.length > 1;
  return (
    <>
      <div className={styles.headword}>
        <h1>{headline.word}</h1>
        <Pronounce word={headline.word} />
        {headline.transcription && <span className={styles.transcription}>{ipa(headline.transcription)}</span>}
      </div>
      {tabbed && (
        <div
          className={styles.tabs}
          role="tablist"
          aria-label={t('datasets_label')}
          onKeyDown={onKeyDown}
          data-testid="dataset-tabs"
        >
          {tabs.map(({ dataset, title }) => (
            <button
              key={dataset}
              type="button"
              role="tab"
              id={tabId(dataset)}
              className={dataset === selected ? styles.tabActive : styles.tab}
              aria-selected={dataset === selected}
              aria-controls={panelId(dataset)}
              tabIndex={dataset === selected ? 0 : -1}
              onClick={() => select(dataset)}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      {tabs.map(({ dataset }) => (
        <div
          key={dataset}
          hidden={dataset !== selected}
          role={tabbed ? 'tabpanel' : undefined}
          id={tabbed ? panelId(dataset) : undefined}
          aria-labelledby={tabbed ? tabId(dataset) : undefined}
          aria-busy={dataset === selected ? pending : undefined}
          tabIndex={tabbed ? 0 : undefined}
        >
          {dataset === selected && children}
        </div>
      ))}
    </>
  );
};
