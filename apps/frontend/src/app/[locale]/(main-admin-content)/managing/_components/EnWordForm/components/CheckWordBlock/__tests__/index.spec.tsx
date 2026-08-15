import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnEntryTypesE, EnPartOfSpeechE } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

import { CheckWordBlock } from '../index';

const renderBlock = (props: Partial<React.ComponentProps<typeof CheckWordBlock>> = {}) =>
  render(
    <CheckWordBlock
      word="run"
      setWord={jest.fn()}
      partOfSpeech={EnPartOfSpeechE.verb}
      setPartOfSpeech={jest.fn()}
      checkWord={jest.fn()}
      checking={false}
      type={EnEntryTypesE.word}
      setType={jest.fn()}
      {...props}
    />,
  );

const checkButton = () => screen.getByRole('button');

describe('CheckWordBlock guards (issue #189)', () => {
  it('enables the check button for a valid word and part of speech', () => {
    renderBlock();
    expect(checkButton()).toBeEnabled();
  });

  it('disables the check button for an empty or whitespace-only word', () => {
    renderBlock({ word: '   ' });
    expect(checkButton()).toBeDisabled();
  });

  it('disables the check button without a part of speech', () => {
    renderBlock({ partOfSpeech: null });
    expect(checkButton()).toBeDisabled();
  });

  it('disables the button while the check request is in flight', () => {
    renderBlock({ checking: true });
    expect(checkButton()).toBeDisabled();
  });
});
