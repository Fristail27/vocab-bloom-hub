'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { App, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { PublicSearchWordV1T } from 'server/types';
import { Input } from '@/core/ui/Input';
import { EnApi } from '@/core/api/EnApi';
import { useDebounced } from '@/core/hooks';
import { FoundWord } from './components/FoundWord';
import styles from './styles.module.scss';

export const SearchModule: React.FC = () => {
  const t = useTranslations('en_managing_words');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();
  // `?search=` deep-links into the search (synonym tags link here); the input stays editable
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState<string>(searchParams.get('search') ?? '');
  const [words, setWords] = useState<PublicSearchWordV1T[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const debouncedValue = useDebounced(searchValue, 400);

  useEffect(() => {
    (async () => {
      if (debouncedValue.length > 0) {
        setIsSearching(true);
        const res = await EnApi.search(debouncedValue);
        setIsSearching(false);
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
        {isSearching && <Skeleton active paragraph={{ rows: 4 }} title={false} />}
        {!isSearching &&
          words.map((w) => (
            <FoundWord
              key={w.id}
              w={w}
              onDeleted={(id) => setWords((prev) => prev.filter((word) => word.id !== id))}
            />
          ))}
      </div>
    </section>
  );
};
