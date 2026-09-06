'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Typography } from 'antd';
import { Select } from '@/core/ui/Select';
import { EnApi } from '@/core/api/EnApi';
import { useDebounced } from '@/core/hooks';
import { EnPartOfSpeechE, PublicSearchWordV1T, EnWordFormsE } from 'server/types';
import { WordLinkKindT } from '../WordLinks';
import styles from './styles.module.scss';

const { Text } = Typography;

type FoundWordT = { word: string; parts_of_speech: EnPartOfSpeechE[] };

// One option per headword; a word with several base-form entries ("run" the
// verb and the noun) lists every part of speech so the admin knows what the
// link will point at
const groupByWord = (words: PublicSearchWordV1T[]): FoundWordT[] => {
  const byWord = new Map<string, EnPartOfSpeechE[]>();
  for (const w of words) {
    if (w.form_of_word !== EnWordFormsE.base_form) continue;
    const parts = byWord.get(w.word) ?? [];
    if (!parts.includes(w.part_of_speech)) parts.push(w.part_of_speech);
    byWord.set(w.word, parts);
  }
  return [...byWord].map(([word, parts_of_speech]) => ({ word, parts_of_speech }));
};

type WordLinksSelectP = {
  kind: WordLinkKindT;
  value: string[];
  onChange: (value: string[]) => void;
  // The meaning's own headword is never offered as its synonym or antonym
  headword?: string | undefined;
  // Words picked for the other relation of the same meaning: the server
  // rejects a word that is both a synonym and an antonym, so hide them here
  exclude?: readonly string[] | undefined;
  containerClassName?: string | undefined;
};

/**
 * Multi-select over existing dictionary entries for one relation of a meaning
 * (synonyms or antonyms): the links are stored as references to words, so
 * only words the dictionary already has can be picked. Options come from the
 * search endpoint as the admin types.
 */
export const WordLinksSelect: React.FC<WordLinksSelectP> = ({
  kind,
  value,
  onChange,
  headword,
  exclude,
  containerClassName,
}) => {
  const t = useTranslations('en_managing_words');
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<FoundWordT[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounced(search.trim().toLowerCase(), 300);

  useEffect(() => {
    // a cleared search keeps the last result set, so several words from the
    // same search can be picked one after another
    if (!debouncedSearch) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await EnApi.search(debouncedSearch);
      if (cancelled) return;
      setLoading(false);
      // only base-form entries qualify as link targets: inflected forms the
      // search may return on their own ("dashed", "ran") are dropped
      setFound('error' in res ? [] : groupByWord(res));
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const self = headword?.trim().toLowerCase();
  const options = useMemo(() => {
    const hidden = new Set(exclude ?? []);
    return found
      .filter(({ word }) => word !== self && !hidden.has(word))
      .map(({ word, parts_of_speech }) => ({
        value: word,
        label: (
          <span className={styles.option}>
            <span>{word}</span>
            <Text type="secondary" className={styles.partOfSpeech}>
              {parts_of_speech.join(', ')}
            </Text>
          </span>
        ),
      }));
  }, [found, self, exclude]);

  return (
    <Select<string[]>
      label={t(kind)}
      containerClassName={containerClassName ?? styles.wordLinksSelect}
      mode="multiple"
      // the picked tags show the bare word; the part of speech is only a hint in the dropdown
      optionLabelProp="value"
      showSearch
      filterOption={false}
      searchValue={search}
      onSearch={setSearch}
      value={value}
      onChange={(v) => {
        onChange(v);
        setSearch('');
      }}
      options={options}
      loading={loading}
      placeholder={t(`${kind}_placeholder`)}
      notFoundContent={
        loading ? (
          <Spin size="small" />
        ) : search.trim() ? (
          <Text type="secondary">{t('word_link_not_found')}</Text>
        ) : null
      }
    />
  );
};
