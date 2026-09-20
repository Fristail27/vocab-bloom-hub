import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { UpdateCheckT } from 'server/types/settings/SettingsApiTypes';

jest.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { DISMISSED_UPDATE_STORAGE_KEY, UpdateNotice } from '../index';

const update = (over: Partial<UpdateCheckT> = {}): UpdateCheckT => ({
  enabled: true,
  current: '1.0.0',
  latest: '1.1.0',
  update_available: true,
  release_url: 'https://github.com/Fristail27/vocab-bloom-hub/releases/tag/v1.1.0',
  checked_at: '2026-09-20T12:00:00.000Z',
  ...over,
});

describe('UpdateNotice (issue #477)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('names both versions and links the release notes and the documentation of the upgrade', () => {
    render(<UpdateNotice update={update()} />);

    expect(screen.getByTestId('update-notice')).toHaveTextContent(
      'available {"latest":"1.1.0","current":"1.0.0"}',
    );
    const notes = screen.getByRole('link', { name: 'release_notes' });
    expect(notes).toHaveAttribute('href', 'https://github.com/Fristail27/vocab-bloom-hub/releases/tag/v1.1.0');
    // the documentation section, on the website, in the interface locale
    const howTo = screen.getByRole('link', { name: 'how_to_update' });
    expect(howTo).toHaveAttribute('href', 'https://vocab-bloom-hub.com/de/docs/upgrading#update-notice');
    for (const link of [notes, howTo]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it.each([
    ['nothing newer', update({ update_available: false, latest: '1.0.0' })],
    ['an unknown latest release', update({ update_available: false, latest: null, release_url: null })],
    ['the check turned off', update({ enabled: false, update_available: false, latest: null })],
    ['no answer from the server', null],
  ])('renders nothing with %s', (_name, value) => {
    render(<UpdateNotice update={value} />);
    expect(screen.queryByTestId('update-notice')).not.toBeInTheDocument();
  });

  it('keeps the documentation link when the release has no page', () => {
    render(<UpdateNotice update={update({ release_url: null })} />);
    expect(screen.queryByRole('link', { name: 'release_notes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'how_to_update' })).toBeInTheDocument();
  });

  it('stays closed for the dismissed release and comes back for the next one', () => {
    const { unmount } = render(<UpdateNotice update={update()} />);
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(screen.queryByTestId('update-notice')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISSED_UPDATE_STORAGE_KEY)).toBe('1.1.0');
    unmount();

    render(<UpdateNotice update={update()} />);
    expect(screen.queryByTestId('update-notice')).not.toBeInTheDocument();

    render(<UpdateNotice update={update({ latest: '1.2.0' })} />);
    expect(screen.getByTestId('update-notice')).toBeInTheDocument();
  });
});
