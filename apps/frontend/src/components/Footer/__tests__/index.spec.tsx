import React from 'react';
import { render, screen } from '@testing-library/react';
import { version as packageVersion } from '../../../../package.json';

jest.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { Footer } from '../index';

describe('Footer', () => {
  it('links the documentation and the repository in a new tab', () => {
    render(<Footer settings={{ version: '9.9.9' }} />);

    const docs = screen.getByRole('link', { name: 'docs' });
    // the documentation of the website, in the interface locale
    expect(docs).toHaveAttribute('href', 'https://vocab-bloom-hub.com/de/docs');
    const github = screen.getByRole('link', { name: 'GitHub' });
    expect(github).toHaveAttribute('href', 'https://github.com/Fristail27/vocab-bloom-hub');
    for (const link of [docs, github]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('shows the version of the server settings', () => {
    render(<Footer settings={{ version: '9.9.9' }} />);
    expect(screen.getByText('version {"version":"9.9.9"}')).toBeInTheDocument();
  });

  it('marks an outdated version with a link to the documentation of the upgrade', () => {
    render(
      <Footer
        settings={{ version: '1.0.0' }}
        update={{
          enabled: true,
          current: '1.0.0',
          latest: '1.1.0',
          update_available: true,
          release_url: null,
          checked_at: null,
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'update_available {"latest":"1.1.0"}' })).toHaveAttribute(
      'href',
      'https://vocab-bloom-hub.com/de/docs/upgrading#update-notice',
    );
  });

  it('shows no update mark without one', () => {
    render(<Footer settings={{ version: '1.0.0' }} update={null} />);
    expect(screen.queryByRole('link', { name: /update_available/ })).not.toBeInTheDocument();
  });

  // the settings endpoint is admin-only: the login page gets an empty object
  it('falls back to the version of the build when the settings carry none', () => {
    render(<Footer settings={{}} />);
    expect(screen.getByText(`version {"version":"${packageVersion}"}`)).toBeInTheDocument();
  });
});
