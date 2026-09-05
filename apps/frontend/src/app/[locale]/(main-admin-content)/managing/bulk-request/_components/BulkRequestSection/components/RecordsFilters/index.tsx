'use client';

import React from 'react';
import { SourceKindE, SourceStateT } from '../../types';
import { WordsFilters } from './WordsFilters';
import { MeaningsFilters } from './MeaningsFilters';
import { TranslationsFilters } from './TranslationsFilters';
import { ShortTranslationsFilters } from './ShortTranslationsFilters';

type RecordsFiltersP = {
  source: SourceStateT;
  onChange: (next: SourceStateT) => void;
};

/** The filter row of the chosen table */
export const RecordsFilters: React.FC<RecordsFiltersP> = ({ source, onChange }) => {
  switch (source.kind) {
    case SourceKindE.words:
      return (
        <WordsFilters
          value={source.filter}
          onChange={(filter) => onChange({ kind: SourceKindE.words, filter })}
        />
      );
    case SourceKindE.meanings:
      return (
        <MeaningsFilters
          value={source.filter}
          onChange={(filter) => onChange({ kind: SourceKindE.meanings, filter })}
        />
      );
    case SourceKindE.translations:
      return (
        <TranslationsFilters
          value={source.filter}
          onChange={(filter) => onChange({ kind: SourceKindE.translations, filter })}
        />
      );
    case SourceKindE.short_translations:
      return (
        <ShortTranslationsFilters
          value={source.filter}
          onChange={(filter) => onChange({ kind: SourceKindE.short_translations, filter })}
        />
      );
  }
};
