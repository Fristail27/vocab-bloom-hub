import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnIssueRecordsT, EnIssuesStatisticsT } from 'server/types';

const router = { push: jest.fn(), replace: jest.fn() };
let query = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => query }));
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: { count: number }) =>
    values ? `${key}: ${values.count}` : key,
}));
jest.mock('@/components/EditedDataset', () => ({ useEditedDataset: () => ({ edited: { name: 'mine' } }) }));
jest.mock('@/core/api/EnApi', () => ({
  EnApi: { getIssuesStatistics: jest.fn(), getIssueRecords: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { IssuesBrowser } from '../IssuesBrowser';

const stats: EnIssuesStatisticsT = {
  dataset: 'mine',
  issues: [
    {
      key: 'meanings_without_examples',
      kind: 'meaning',
      interpretation: 'informational',
      count: 26,
      total: 40,
    },
  ],
};
const list: EnIssueRecordsT = {
  dataset: 'mine',
  category: 'meanings_without_examples',
  kind: 'meaning',
  interpretation: 'informational',
  page: 2,
  limit: 25,
  total: 26,
  items: [
    {
      id: 42,
      word_id: 7,
      word: 'inspect',
      part_of_speech: 'verb' as EnIssueRecordsT['items'][number]['part_of_speech'],
      meaning_id: 42,
      meaning_title: 'precise sense',
      meaning_definition: 'precise definition',
      language: null,
      text: null,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  query = new URLSearchParams('dataset=mine');
  (EnApi.getIssuesStatistics as jest.Mock).mockResolvedValue(stats);
  (EnApi.getIssueRecords as jest.Mock).mockResolvedValue(list);
});

it('links the counter to its dataset/category and explains informational data', async () => {
  render(<IssuesBrowser />);
  const link = await screen.findByRole('link', { name: 'meanings_without_examples' });
  expect(link).toHaveAttribute(
    'href',
    '/en/statistics/issues?dataset=mine&category=meanings_without_examples&page=1',
  );
  expect(screen.getByText('interpretation_informational')).toBeInTheDocument();
});

it('links the exact meaning to its editor, retaining the dataset and second page', async () => {
  query = new URLSearchParams('dataset=mine&category=meanings_without_examples&page=2');
  render(<IssuesBrowser />);
  const link = await screen.findByRole('link', { name: /inspect.*open_record/ });
  expect(link).toHaveAttribute(
    'href',
    '/en/managing/edit-word/7?dataset=mine&category=meanings_without_examples&page=2#meaning-42',
  );
  expect(screen.getByText('precise sense — precise definition')).toBeInTheDocument();
  expect(EnApi.getIssueRecords).toHaveBeenCalledWith({
    dataset: 'mine',
    category: 'meanings_without_examples',
    page: 2,
    limit: 25,
  });
  expect(EnApi.getIssuesStatistics).not.toHaveBeenCalled();
});

it('refreshes restored pages and replaces an emptied last page with the server page', async () => {
  query = new URLSearchParams('dataset=mine&category=meanings_without_examples&page=2');
  render(<IssuesBrowser />);
  await screen.findByRole('link', { name: /inspect.*open_record/ });
  (EnApi.getIssueRecords as jest.Mock).mockResolvedValue({ ...list, page: 1, total: 0, items: [] });
  fireEvent(window, new Event('pageshow'));
  expect(await screen.findByText('no_matching_records')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /inspect.*open_record/ })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(
      '/en/statistics/issues?dataset=mine&category=meanings_without_examples&page=1',
      { scroll: false },
    ),
  );
});

it('does not turn an API error into an empty category', async () => {
  query = new URLSearchParams('dataset=mine&category=meanings_without_examples');
  (EnApi.getIssueRecords as jest.Mock).mockResolvedValue({ error: true, message: 'unknown_error' });
  render(<IssuesBrowser />);
  expect(await screen.findByText('unknown_error')).toBeInTheDocument();
  expect(screen.queryByText('no_matching_records')).not.toBeInTheDocument();
});

it('rejects unknown categories before making requests', () => {
  query = new URLSearchParams('dataset=mine&category=not_a_category');
  render(<IssuesBrowser />);
  expect(screen.getByText('invalid_category')).toBeInTheDocument();
  expect(EnApi.getIssueRecords).not.toHaveBeenCalled();
});
