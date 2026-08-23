import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnPartOfSpeechE, EnSearchWordT, EnWordFormsE } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/core/hooks', () => ({
  useDebounced: (value: string) => value,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { search: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { SynonymsSelect } from '../index';

const makeWord = (id: number, word: string, form_of_word = EnWordFormsE.base_form): EnSearchWordT =>
  ({
    id,
    word,
    part_of_speech: EnPartOfSpeechE.adjective,
    form_of_word,
    forms: [],
  }) as unknown as EnSearchWordT;

describe('SynonymsSelect (issue #259)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the selected synonyms as tags', () => {
    render(<SynonymsSelect value={['clever', 'smart']} onChange={jest.fn()} />);
    expect(screen.getByText('clever')).toBeInTheDocument();
    expect(screen.getByText('smart')).toBeInTheDocument();
  });

  it('offers base-form dictionary words matching the typed text, without the headword, and reports the pick', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([
      makeWord(1, 'bright'),
      makeWord(2, 'brilliant'),
      makeWord(3, 'brilliant'),
      // an inflected form on its own is never a synonym target
      makeWord(4, 'brighter', EnWordFormsE.comparative_form),
    ]);
    const onChange = jest.fn();

    render(<SynonymsSelect value={[]} onChange={onChange} headword="Bright" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bri' } });

    await waitFor(() => expect(EnApi.search).toHaveBeenCalledWith('bri'));
    // the headword is filtered out, duplicates collapse into one option
    const option = await screen.findByText('brilliant', { selector: '.ant-select-item-option-content' });
    expect(
      screen.queryByText('bright', { selector: '.ant-select-item-option-content' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('brighter', { selector: '.ant-select-item-option-content' }),
    ).not.toBeInTheDocument();

    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(['brilliant']);
  });

  it('does not query the API for a blank search', async () => {
    render(<SynonymsSelect value={[]} onChange={jest.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '   ' } });
    await waitFor(() => expect(EnApi.search).not.toHaveBeenCalled());
  });
});
