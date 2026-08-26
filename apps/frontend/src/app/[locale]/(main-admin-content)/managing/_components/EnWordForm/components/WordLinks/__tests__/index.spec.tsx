import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useLocale: () => 'ru',
}));

import { WordLinks } from '../index';

describe('WordLinks (issues #259, #266)', () => {
  it('renders every synonym as a link to the dictionary search for that word', () => {
    render(<WordLinks kind="synonyms" words={['clever', 'give up']} />);

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['clever', 'give up']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/ru/managing?search=clever',
      '/ru/managing?search=give%20up',
    ]);
  });

  it('renders antonyms with their own tag colour', () => {
    const { container } = render(<WordLinks kind="antonyms" words={['dull']} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/ru/managing?search=dull');
    expect(container.querySelector('.ant-tag-volcano')).not.toBeNull();
    expect(container.querySelector('.ant-tag-purple')).toBeNull();
  });

  it('shows a close icon per tag only when onRemove is given, and reports the word without navigating', () => {
    const { container, rerender } = render(<WordLinks kind="synonyms" words={['clever']} />);
    expect(container.querySelector('.ant-tag-close-icon')).toBeNull();

    const onRemove = jest.fn();
    rerender(<WordLinks kind="synonyms" words={['clever', 'smart']} onRemove={onRemove} />);
    const closeIcons = container.querySelectorAll('.ant-tag-close-icon');
    expect(closeIcons).toHaveLength(2);

    fireEvent.click(closeIcons[1]);
    expect(onRemove).toHaveBeenCalledWith('smart');
    // the tag stays until the owner drops the word from the list
    expect(screen.getByText('smart')).toBeInTheDocument();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<WordLinks kind="antonyms" words={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
