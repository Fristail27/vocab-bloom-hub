import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { EnWordFormsE, EnPartOfSpeechE, EnSearchWordT } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('@/core/hooks', () => ({
  useDebounced: (value: string) => value,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { search: jest.fn(), deleteWord: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { SearchModule } from '../index';

const makeWord = (id: number, word: string): EnSearchWordT =>
  ({
    id,
    word,
    part_of_speech: EnPartOfSpeechE.verb,
    form_of_word: EnWordFormsE.base_form,
    forms: [],
  }) as unknown as EnSearchWordT;

const renderModule = () =>
  render(
    <App>
      <SearchModule />
    </App>,
  );

const searchFor = async (value: string, firstExpectedWord: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  await screen.findByText(firstExpectedWord);
};

const clickDeleteInPopover = async (wordIndex: number) => {
  fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[wordIndex]);
  const confirmButton = await screen.findByText('delete_word');
  // the confirm handler is async (API call + toast + state update) — flush it inside act
  await act(async () => {
    fireEvent.click(confirmButton);
  });
};

describe('SearchModule (issue #176)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('убирает слово из списка после успешного удаления', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([makeWord(1, 'run'), makeWord(2, 'jump')]);
    (EnApi.deleteWord as jest.Mock).mockResolvedValue({ success: true });

    renderModule();
    await searchFor('ru', 'run');
    expect(screen.getByText('jump')).toBeInTheDocument();

    await clickDeleteInPopover(0);

    expect(EnApi.deleteWord).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.queryByText('run')).not.toBeInTheDocument());
    expect(screen.getByText('jump')).toBeInTheDocument();
  });

  it('оставляет слово в списке, если удаление вернуло ошибку', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([makeWord(1, 'run')]);
    (EnApi.deleteWord as jest.Mock).mockResolvedValue({ error: true, message: 'some_error' });

    renderModule();
    await searchFor('ru', 'run');

    await clickDeleteInPopover(0);

    await screen.findByText('some_error'); // error toast with the passthrough translation key
    // 'run' appears both in the list and in the popover title — the list entry must survive
    expect(screen.getAllByText('run').length).toBeGreaterThan(0);
  });

  it('показывает тост при ошибке поиска и не рендерит список', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue({ error: true, message: 'failed_fetch' });

    renderModule();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ru' } });

    await screen.findByText('failed_fetch');
    expect(screen.queryAllByRole('button', { name: 'delete' })).toHaveLength(0);
  });
});
