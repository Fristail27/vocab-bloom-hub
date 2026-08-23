import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useLocale: () => 'ru',
}));

import { SynonymLinks } from '../index';

describe('SynonymLinks (issue #259)', () => {
  it('renders every synonym as a link to the dictionary search for that word', () => {
    render(<SynonymLinks synonyms={['clever', 'give up']} />);

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['clever', 'give up']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/ru/managing?search=clever',
      '/ru/managing?search=give%20up',
    ]);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<SynonymLinks synonyms={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
