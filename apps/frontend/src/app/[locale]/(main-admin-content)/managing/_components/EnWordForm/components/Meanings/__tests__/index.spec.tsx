import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

import { Meanings } from '../index';

const makeMeaning = (overrides: Partial<EnMeaningT> = {}): EnMeaningT => ({
  id: 1,
  title: 'to move fast',
  definition: 'to move at a speed faster than a walk',
  sort_order: 1,
  is_obsolete: false,
  area_variant: EnAreaVariantsE.common,
  language_register: LanguageRegisterE.formal,
  meaning_level: null,
  examples: [],
  translations: [],
  ...overrides,
});

const nextButton = () => screen.getByText('next_step').closest('button')!;

describe('Meanings step validation (issue #189)', () => {
  it('enables Next when every meaning has a title and a definition', () => {
    render(<Meanings meanings={[makeMeaning()]} setMeanings={jest.fn()} onClickNext={jest.fn()} />);
    expect(nextButton()).toBeEnabled();
  });

  it('enables Next when there are no meanings at all', () => {
    render(<Meanings meanings={[]} setMeanings={jest.fn()} onClickNext={jest.fn()} />);
    expect(nextButton()).toBeEnabled();
  });

  it('disables Next while a meaning has a blank title', () => {
    render(
      <Meanings
        meanings={[makeMeaning(), makeMeaning({ id: 2, title: '   ' })]}
        setMeanings={jest.fn()}
        onClickNext={jest.fn()}
      />,
    );
    expect(nextButton()).toBeDisabled();
  });

  it('disables Next while a meaning has a blank definition', () => {
    render(
      <Meanings meanings={[makeMeaning({ definition: '' })]} setMeanings={jest.fn()} onClickNext={jest.fn()} />,
    );
    expect(nextButton()).toBeDisabled();
  });
});
