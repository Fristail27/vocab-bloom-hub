import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

import { WordAlreadyExistBlock } from '../index';

describe('WordAlreadyExistBlock (issue #175)', () => {
  it('строит ссылку на реальный роут редактирования с id и локалью', () => {
    render(<WordAlreadyExistBlock word="run" wordId={7} />);

    const link = screen.getByText('edit_word_link');
    expect(link).toHaveAttribute('href', '/en/managing/edit-word/7');
  });

  it('не рендерит ссылку без id существующего слова', () => {
    render(<WordAlreadyExistBlock word="run" wordId={null} />);

    expect(screen.getByText('run')).toBeInTheDocument();
    expect(screen.queryByText('edit_word_link')).not.toBeInTheDocument();
  });
});
