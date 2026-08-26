import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('@/core/hooks', () => ({
  useDebounced: (value: string) => value,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { search: jest.fn(), editMeaning: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { UpdateTypeE, WordCardModeE } from '../../../../../constants';
import { WordLinksEditor } from '../index';

const meaning: EnMeaningT = {
  id: 7,
  title: 'shining',
  definition: 'giving out much light',
  sort_order: 1,
  is_obsolete: false,
  area_variant: EnAreaVariantsE.common,
  language_register: LanguageRegisterE.formal,
  meaning_level: null,
  examples: [],
  synonyms: ['vivid'],
  antonyms: ['dull'],
  translations: [],
};

const renderEditor = (mode: WordCardModeE, updateMeaning = jest.fn()) => {
  render(
    <App>
      <WordLinksEditor
        kind="antonyms"
        meaning={meaning}
        mode={mode}
        updateMeaning={updateMeaning}
        headword="bright"
      />
    </App>,
  );
  return updateMeaning;
};

describe('WordLinksEditor (issue #266)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows plain link tags without controls in view mode', () => {
    renderEditor(WordCardModeE.view);

    expect(screen.getByRole('link', { name: 'dull' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-tag-close-icon')).toBeNull();
  });

  it('unlinks a word from its tag and saves the rest right away', async () => {
    (EnApi.editMeaning as jest.Mock).mockResolvedValue({ success: true });
    const updateMeaning = renderEditor(WordCardModeE.edit);

    fireEvent.click(document.querySelector('.ant-tag-close-icon') as Element);

    await waitFor(() => expect(EnApi.editMeaning).toHaveBeenCalledWith({ id: 7, antonyms: [] }));
    expect(updateMeaning).toHaveBeenCalledWith({ ...meaning, antonyms: [] }, UpdateTypeE.edit);
  });

  it('keeps the stored list when the server rejects the change', async () => {
    (EnApi.editMeaning as jest.Mock).mockResolvedValue({ error: true, message: 'synonym_antonym_conflict' });
    const updateMeaning = renderEditor(WordCardModeE.edit);

    fireEvent.click(document.querySelector('.ant-tag-close-icon') as Element);

    await waitFor(() => expect(EnApi.editMeaning).toHaveBeenCalled());
    expect(updateMeaning).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'dull' })).toBeInTheDocument();
  });

  it('opens a picker with the plus button that adds a dictionary word and hides the synonyms of the meaning', async () => {
    (EnApi.editMeaning as jest.Mock).mockResolvedValue({ success: true });
    (EnApi.search as jest.Mock).mockResolvedValue([
      { id: 1, word: 'dim', part_of_speech: 'adjective', form_of_word: 'base_form', forms: [] },
      { id: 2, word: 'vivid', part_of_speech: 'adjective', form_of_word: 'base_form', forms: [] },
    ]);
    const updateMeaning = renderEditor(WordCardModeE.edit);

    fireEvent.click(screen.getByRole('button', { name: 'plus' }));
    // the picker replaces the tags and already holds the stored words
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('dull')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'd' } });
    const option = await screen.findByText('dim', { selector: '.ant-select-item-option-content span' });
    // "vivid" is a synonym of this meaning, so it is not offered as an antonym
    expect(
      screen.queryByText('vivid', { selector: '.ant-select-item-option-content span' }),
    ).not.toBeInTheDocument();
    fireEvent.click(option);

    await waitFor(() => expect(EnApi.editMeaning).toHaveBeenCalledWith({ id: 7, antonyms: ['dull', 'dim'] }));
    expect(updateMeaning).toHaveBeenCalledWith({ ...meaning, antonyms: ['dull', 'dim'] }, UpdateTypeE.edit);

    // the check button closes the picker and the tags are back
    fireEvent.click(screen.getByRole('button', { name: 'check' }));
    expect(screen.getByRole('link', { name: 'dull' })).toBeInTheDocument();
  });
});
