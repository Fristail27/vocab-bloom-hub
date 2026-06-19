'use client';

import React, { useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslations } from 'next-intl';
import { EnWordT } from 'server/types';
import { Input } from '@/core/ui/Input';
import { EnApi } from '@/core/api/EnApi';
import { useDebounced } from '@/core/hooks';
import { FoundWord } from './components/FoundWord';
import styles from './styles.module.scss';

export const SearchModule: React.FC = () => {
  const t = useTranslations('en_managing_words');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();
  const [searchValue, setSearchValue] = useState<string>('');
  const [words, setWords] = useState<EnWordT[]>([]);
  const debouncedValue = useDebounced(searchValue, 400);

  useEffect(() => {
    (async () => {
      if (debouncedValue.length > 0) {
        const res = await EnApi.search(debouncedValue);
        if ('error' in res) {
          const mes = tErr(res.message);
          message.error(mes);
        } else {
          setWords(res);
        }
      }
    })();
  }, [debouncedValue]);

  return (
    <section className={styles.searchModule}>
      <Input
        label={t('dictionary_search')}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      <div>
        {words.map((w) => (
          <FoundWord key={w.id} w={w} />
        ))}
      </div>
    </section>
  );
};
