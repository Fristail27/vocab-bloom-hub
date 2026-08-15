import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

import { MeaningsTranslations } from '../index';
import { MeaningPreview } from '../components/MeaningPreview';

const meaning: EnMeaningT = {
  id: 1,
  title: 'to search for information',
  definition: 'to try to find a piece of information',
  sort_order: 1,
  is_obsolete: false,
  area_variant: EnAreaVariantsE.common,
  language_register: LanguageRegisterE.formal,
  meaning_level: WordLevelE.B1,
  examples: ['I looked it up in the dictionary'],
  translations: [],
};

describe('wizard localization (issue #174)', () => {
  it('MeaningPreview renders labels through next-intl keys, without hardcoded Russian', () => {
    const { container } = render(<MeaningPreview m={meaning} />);

    for (const key of ['level', 'register', 'regional_label', 'examples']) {
      expect(screen.getByText(`${key}:`)).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/[А-Яа-яЁё]/);
  });

  it('MeaningsTranslations renders the Next button through next-intl, without hardcoded Russian', () => {
    const { container } = render(
      <MeaningsTranslations meanings={[meaning]} setMeanings={jest.fn()} onClickNext={jest.fn()} />,
    );

    expect(screen.getByText('next_step')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[А-Яа-яЁё]/);
  });
});
