import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { EnDatasetsStatisticsT } from 'server/types';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
jest.mock('@/core/api/EnApi', () => ({ EnApi: { getDatasetsStatistics: jest.fn() } }));
import { EnApi } from '@/core/api/EnApi';
import { DatasetStatistics } from '../DatasetStatistics';

const totals = {
  entries: 1234,
  words: 12,
  word_forms: 4,
  phrases: 1,
  grammar_patterns: 0,
  meanings: 3,
  meaning_translations: 2,
  short_translations: 1,
};
const result: EnDatasetsStatisticsT = {
  read_at: '2026-10-19T12:00:00Z',
  datasets: [
    {
      dataset: { name: 'mine', title: 'My dictionary', version: '2', active: false, is_public: false },
      totals,
      error: null,
      updating: true,
    },
    {
      dataset: { name: 'default', title: 'Active dictionary', version: null, active: true, is_public: true },
      totals: null,
      error: 'statistics_unavailable',
      updating: false,
    },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
});

it('keeps per-dataset counts, errors, status and explicit navigation together', async () => {
  jest.mocked(EnApi.getDatasetsStatistics).mockResolvedValue(result);
  render(<DatasetStatistics />);
  const mine = within(await screen.findByRole('region', { name: 'My dictionary' }));
  expect(mine.getByText('1,234')).toBeInTheDocument();
  expect(mine.getByText('status_closed')).toBeInTheDocument();
  expect(mine.getByText('statistics_updating')).toBeInTheDocument();
  for (const page of ['common', 'translations', 'issues']) {
    expect(mine.getByRole('link', { name: `${page}_statistics` })).toHaveAttribute(
      'href',
      `/en/statistics/${page}?dataset=mine`,
    );
  }
  const failed = within(screen.getByRole('region', { name: 'Active dictionary' }));
  expect(failed.getByText('statistics_unavailable')).toBeInTheDocument();
  expect(failed.queryByText('0')).not.toBeInTheDocument();
  expect(failed.getByText('status_active')).toBeInTheDocument();
});

it('shows loading and empty results, and refreshes an unavailable overview', async () => {
  let resolve!: (value: EnDatasetsStatisticsT) => void;
  jest.mocked(EnApi.getDatasetsStatistics).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<DatasetStatistics />);
  expect(screen.getByRole('status')).toHaveTextContent('statistics_loading');
  resolve({ ...result, datasets: [] });
  expect(await screen.findByText('no_installed_datasets')).toBeInTheDocument();
  jest.mocked(EnApi.getDatasetsStatistics).mockResolvedValueOnce({ error: true, message: 'failed_fetch' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'refresh_statistics' })).not.toHaveClass('ant-btn-loading'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'refresh_statistics' }));
  expect(await screen.findByText('statistics_unavailable')).toBeInTheDocument();
  jest.mocked(EnApi.getDatasetsStatistics).mockResolvedValueOnce(result);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'refresh_statistics' })).not.toHaveClass('ant-btn-loading'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'refresh_statistics' }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'My dictionary' })).toBeInTheDocument());
});
