import React from 'react';
import { Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EnMeaningListItemT,
  EnMeaningTranslationListItemT,
  EnShortTranslationListItemT,
  EnWordListItemT,
} from 'server/types';
import { BulkItemT, SourceKindE } from '../../types';

const { Text } = Typography;

type TranslateT = (key: string) => string;

const dash = (v?: string | null) => v || '—';

// The table rows are the union of the three listings; each column set reads
// the fields of its own table, hence the narrowing helpers
const asWord = (row: BulkItemT) => row as EnWordListItemT;
const asMeaning = (row: BulkItemT) => row as EnMeaningListItemT;
const asTranslation = (row: BulkItemT) => row as EnMeaningTranslationListItemT;
const asShortTranslation = (row: BulkItemT) => row as EnShortTranslationListItemT;

const identityColumns = (t: TranslateT): ColumnsType<BulkItemT> => [
  { title: t('col_word'), dataIndex: 'word', key: 'word', render: (w: string) => <Text strong>{w}</Text> },
  { title: t('col_part_of_speech'), dataIndex: 'part_of_speech', key: 'part_of_speech' },
];

const wordColumns = (t: TranslateT): ColumnsType<BulkItemT> => [
  ...identityColumns(t),
  { title: t('col_level'), key: 'word_level', render: (_, row) => dash(asWord(row).word_level) },
  { title: t('col_area'), key: 'area_variant', render: (_, row) => dash(asWord(row).area_variant) },
  {
    title: t('col_generated'),
    key: 'generated',
    render: (_, row) => (asWord(row).generated ? <Tag color="blue">AI</Tag> : '—'),
  },
  {
    title: t('col_model'),
    key: 'generated_by_model',
    render: (_, row) => dash(asWord(row).generated_by_model),
  },
  { title: t('col_version'), key: 'version', render: (_, row) => asWord(row).version },
  {
    title: t('col_meanings'),
    key: 'meanings_count',
    align: 'right',
    render: (_, row) => asWord(row).meanings_count,
  },
  {
    title: t('col_short_translations'),
    key: 'short_translations_count',
    align: 'right',
    render: (_, row) => asWord(row).short_translations_count,
  },
];

const meaningColumns = (t: TranslateT): ColumnsType<BulkItemT> => [
  ...identityColumns(t),
  { title: t('col_title'), key: 'title', render: (_, row) => asMeaning(row).title },
  {
    title: t('col_definition'),
    key: 'definition',
    ellipsis: true,
    render: (_, row) => asMeaning(row).definition,
  },
  { title: t('col_level'), key: 'meaning_level', render: (_, row) => dash(asMeaning(row).meaning_level) },
  { title: t('col_area'), key: 'area_variant', render: (_, row) => dash(asMeaning(row).area_variant) },
  {
    title: t('col_register'),
    key: 'language_register',
    render: (_, row) => dash(asMeaning(row).language_register),
  },
  {
    title: t('col_obsolete'),
    key: 'is_obsolete',
    render: (_, row) => (asMeaning(row).is_obsolete ? <Tag color="orange">{t('filter_yes')}</Tag> : '—'),
  },
  {
    title: t('col_translations'),
    key: 'translations_count',
    align: 'right',
    render: (_, row) => asMeaning(row).translations_count,
  },
];

const translationColumns = (t: TranslateT): ColumnsType<BulkItemT> => [
  ...identityColumns(t),
  {
    title: t('col_meaning'),
    key: 'meaning_title',
    ellipsis: true,
    render: (_, row) => asTranslation(row).meaning_title,
  },
  { title: t('col_language'), key: 'language', render: (_, row) => asTranslation(row).language },
  { title: t('col_title'), key: 'title', render: (_, row) => asTranslation(row).title },
  {
    title: t('col_definition'),
    key: 'definition',
    ellipsis: true,
    render: (_, row) => asTranslation(row).definition,
  },
  {
    title: t('col_variants'),
    key: 'variants_of_words',
    ellipsis: true,
    render: (_, row) => dash(asTranslation(row).variants_of_words.join(', ')),
  },
];

const shortTranslationColumns = (t: TranslateT): ColumnsType<BulkItemT> => [
  ...identityColumns(t),
  { title: t('col_language'), key: 'language', render: (_, row) => asShortTranslation(row).language },
  {
    title: t('col_description'),
    key: 'description',
    ellipsis: true,
    render: (_, row) => asShortTranslation(row).description,
  },
  {
    title: t('col_variants'),
    key: 'variants_of_words',
    ellipsis: true,
    render: (_, row) => dash(asShortTranslation(row).variants_of_words.join(', ')),
  },
];

export const columnsFor = (kind: SourceKindE, t: TranslateT): ColumnsType<BulkItemT> => {
  switch (kind) {
    case SourceKindE.words:
      return wordColumns(t);
    case SourceKindE.meanings:
      return meaningColumns(t);
    case SourceKindE.translations:
      return translationColumns(t);
    case SourceKindE.short_translations:
      return shortTranslationColumns(t);
  }
};
