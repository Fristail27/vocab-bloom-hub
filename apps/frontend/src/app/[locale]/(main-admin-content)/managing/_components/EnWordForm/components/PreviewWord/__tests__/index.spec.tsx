import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { EnWordT } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('../../../../WordCard', () => ({
  WordCard: () => <div data-testid="word-card" />,
}));

import { PreviewWord } from '../index';

const word = { word: 'run' } as unknown as Omit<EnWordT, 'word'> & { word: string };

describe('PreviewWord submit guards (issue #189)', () => {
  it('calls addWord on click when idle', () => {
    const addWord = jest.fn();
    render(<PreviewWord word={word} addWord={addWord} submitting={false} />);

    fireEvent.click(screen.getByText('add_word'));
    expect(addWord).toHaveBeenCalledTimes(1);
  });

  it('disables the save button while the request is in flight', () => {
    const addWord = jest.fn();
    render(<PreviewWord word={word} addWord={addWord} submitting={true} />);

    const button = screen.getByText('add_word').closest('button')!;
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(addWord).not.toHaveBeenCalled();
  });
});
