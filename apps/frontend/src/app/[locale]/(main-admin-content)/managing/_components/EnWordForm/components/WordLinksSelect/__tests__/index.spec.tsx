import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnPartOfSpeechE, PublicSearchWordV1T, EnWordFormsE } from 'server/types';

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
import { WordLinksSelect } from '../index';

const makeWord = (
  id: number,
  word: string,
  form_of_word = EnWordFormsE.base_form,
  part_of_speech = EnPartOfSpeechE.adjective,
): PublicSearchWordV1T =>
  ({
    id,
    word,
    part_of_speech,
    form_of_word,
    forms: [],
  }) as unknown as PublicSearchWordV1T;

// the word span inside a dropdown option (the option also carries the part of speech)
const optionWord = { selector: '.ant-select-item-option-content span' };

describe('WordLinksSelect (issues #259, #266)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the selected words as tags under the label of its kind', () => {
    render(<WordLinksSelect kind="synonyms" value={['clever', 'smart']} onChange={jest.fn()} />);
    expect(screen.getByText('clever')).toBeInTheDocument();
    expect(screen.getByText('smart')).toBeInTheDocument();
    expect(screen.getByText('synonyms')).toBeInTheDocument();

    render(<WordLinksSelect kind="antonyms" value={['dull']} onChange={jest.fn()} />);
    expect(screen.getByText('dull')).toBeInTheDocument();
    expect(screen.getByText('antonyms')).toBeInTheDocument();
  });

  it('offers base-form dictionary words matching the typed text with their parts of speech, without the headword, and reports the pick', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([
      makeWord(1, 'bright'),
      makeWord(2, 'brilliant'),
      // a second base-form entry of the same word adds its part of speech to the one option
      makeWord(3, 'brilliant', EnWordFormsE.base_form, EnPartOfSpeechE.noun),
      // an inflected form on its own is never a link target
      makeWord(4, 'brighter', EnWordFormsE.comparative_form),
    ]);
    const onChange = jest.fn();

    render(<WordLinksSelect kind="synonyms" value={[]} onChange={onChange} headword="Bright" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bri' } });

    await waitFor(() => expect(EnApi.search).toHaveBeenCalledWith('bri'));
    // the headword is filtered out, duplicates collapse into one option
    const option = await screen.findByText('brilliant', optionWord);
    expect(screen.getByText('adjective, noun')).toBeInTheDocument();
    expect(screen.queryByText('bright', optionWord)).not.toBeInTheDocument();
    expect(screen.queryByText('brighter', optionWord)).not.toBeInTheDocument();

    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(['brilliant']);
  });

  it('hides the words already picked for the other relation of the meaning (issue #266)', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([makeWord(1, 'dull'), makeWord(2, 'dim')]);

    render(<WordLinksSelect kind="antonyms" value={[]} onChange={jest.fn()} exclude={['dull']} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'd' } });

    await screen.findByText('dim', optionWord);
    expect(screen.queryByText('dull', optionWord)).not.toBeInTheDocument();
  });

  it('does not query the API for a blank search', async () => {
    render(<WordLinksSelect kind="antonyms" value={[]} onChange={jest.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '   ' } });
    await waitFor(() => expect(EnApi.search).not.toHaveBeenCalled());
  });
});
