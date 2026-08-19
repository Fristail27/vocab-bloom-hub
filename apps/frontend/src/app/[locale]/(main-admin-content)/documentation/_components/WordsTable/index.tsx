'use client';

import React from 'react';
import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { ResponseWordT } from '../../utils';
import styles from './styles.module.scss';

const { Text, Paragraph } = Typography;

type WordsTableP = {
  words: ResponseWordT[];
};

const countOf = (list?: unknown[]): number => (Array.isArray(list) ? list.length : 0);

export const WordsTable: React.FC<WordsTableP> = ({ words }) => {
  const t = useTranslations('documentation');

  const columns: ColumnsType<ResponseWordT> = [
    { title: t('col_id'), dataIndex: 'id', key: 'id' },
    {
      title: t('col_word'),
      dataIndex: 'word',
      key: 'word',
      render: (word: string) => <Text strong>{word}</Text>,
    },
    { title: t('col_part_of_speech'), dataIndex: 'part_of_speech', key: 'part_of_speech' },
    {
      title: t('col_level'),
      dataIndex: 'word_level',
      key: 'word_level',
      render: (level?: string) => level ?? '—',
    },
    { title: t('col_area'), dataIndex: 'area_variant', key: 'area_variant' },
    {
      title: t('col_transcription'),
      dataIndex: 'transcription',
      key: 'transcription',
      render: (transcription?: string) => transcription ?? '—',
    },
    {
      title: t('col_meanings'),
      key: 'meanings',
      render: (_, word) => countOf(word.meanings),
    },
    {
      title: t('col_short_translations'),
      key: 'short_translations',
      render: (_, word) => countOf(word.short_translations),
    },
  ];

  const renderMeanings = (word: ResponseWordT) => (
    <div className={styles.meanings}>
      {(word.meanings ?? []).map((meaning) => (
        <div key={meaning.id} className={styles.meaning}>
          <Text strong>{meaning.title}</Text>
          <Paragraph className={styles.definition}>{meaning.definition}</Paragraph>
          {(meaning.translations ?? []).map((translation) => (
            <div key={translation.id} className={styles.translation}>
              <Tag>{translation.language}</Tag>
              <Text>{translation.title}</Text>
              {translation.variants_of_words?.length ? (
                <Text type="secondary">{translation.variants_of_words.join(', ')}</Text>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <Table<ResponseWordT>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={words}
      columns={columns}
      scroll={{ x: true }}
      expandable={{
        expandedRowRender: renderMeanings,
        rowExpandable: (word) => countOf(word.meanings) > 0,
      }}
    />
  );
};
