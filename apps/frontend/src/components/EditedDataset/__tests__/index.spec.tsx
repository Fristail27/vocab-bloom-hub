import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { DatasetT, DatasetsListT } from 'server/types';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { getStatistics: jest.fn(), getDatasets: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { EditedDatasetProvider } from '../index';
import { DatasetSwitch } from '../DatasetSwitch';
import { EditedDatasetBlock } from '../EditedDatasetBlock';

const dataset = (over: Partial<DatasetT>): DatasetT => ({
  name: 'default',
  title: 'Vocab Bloom Hub English dataset',
  own: false,
  installed: true,
  source: 'vocab-bloom-hub',
  language: 'en',
  version: null,
  license: 'CC-BY-4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'The project',
  attribution_url: null,
  notice: null,
  license_text: null,
  active: true,
  is_default: true,
  created_at: '2026-09-30T10:00:00.000Z',
  imported_at: null,
  ...over,
});

const LIST: DatasetsListT = {
  supported: true,
  active: 'default',
  datasets: [
    dataset({}),
    dataset({
      name: 'wiktionary',
      title: 'English Wiktionary',
      source: 'wiktionary',
      license: 'CC-BY-SA-4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      active: false,
      is_default: false,
    }),
    dataset({ name: 'wordnet', installed: false, active: false, is_default: false }),
    dataset({
      name: 'my_words',
      title: 'My words',
      own: true,
      source: 'my_words',
      license: 'House License',
      license_url: 'https://example.org/license',
      active: false,
      is_default: false,
    }),
  ],
};

const renderSwitch = (list: DatasetsListT | null = LIST) =>
  render(
    <App>
      <EditedDatasetProvider initial={list ?? undefined}>
        <DatasetSwitch />
        <EditedDatasetBlock />
      </EditedDatasetProvider>
    </App>,
  );

const choose = async (title: string) => {
  const select = screen.getByTestId('dataset-switch');
  fireEvent.mouseDown(select.querySelector('.ant-select-selector') ?? select);
  const options = await screen.findAllByRole('option');
  const option = options.find((item) => item.textContent?.includes(title));
  // antd renders the options of its virtual list twice: the visible item is not the one of the role
  fireEvent.click(screen.getAllByText(title).find((item) => item.closest('.ant-select-item')) ?? option!);
};

// The dataset that is edited (issue #540): one switch in the header, the block under it
describe('the switch of the dataset that is edited', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = 'edited_dataset=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    (EnApi.getStatistics as jest.Mock).mockResolvedValue({ totals: { entries: 1234 } });
  });

  it('is the active dataset by default, and says what it is', async () => {
    renderSwitch();

    const block = within(screen.getByTestId('edited-dataset'));
    expect(block.getByText('Vocab Bloom Hub English dataset')).toBeInTheDocument();
    expect(block.getByText('active')).toBeInTheDocument();
    expect(block.getByText('catalog')).toBeInTheDocument();
    expect(block.getByRole('link', { name: 'CC-BY-4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );
    expect(await block.findByText('1,234')).toBeInTheDocument();
    // the project's dataset is no public source: nothing to remind of
    expect(screen.queryByTestId('edited-dataset-modified-note')).not.toBeInTheDocument();
  });

  it('offers the installed datasets only, and keeps the choice in a cookie', async () => {
    renderSwitch();

    const select = screen.getByTestId('dataset-switch');
    fireEvent.mouseDown(select.querySelector('.ant-select-selector') ?? select);
    const titles = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(titles.join(' ')).not.toContain('wordnet');

    await choose('My words');
    expect(document.cookie).toContain('edited_dataset=my_words');
    expect(refresh).toHaveBeenCalled();
    const block = within(screen.getByTestId('edited-dataset'));
    await waitFor(() => expect(block.getByText('own')).toBeInTheDocument());
    expect(block.getByText('not_served')).toBeInTheDocument();
    expect(block.getByText(/not_served_note/)).toHaveTextContent('Vocab Bloom Hub English dataset');
    expect(block.getByRole('link', { name: 'House License' })).toBeInTheDocument();
    // the counts are read again, for the dataset that is chosen now
    await waitFor(() => expect(EnApi.getStatistics).toHaveBeenCalledTimes(2));

    // the active one again: no choice is kept
    await choose('Vocab Bloom Hub English dataset');
    expect(document.cookie).not.toContain('edited_dataset=');
  });

  it('reminds that an edit of a dataset of a public source marks the entry as modified', async () => {
    document.cookie = 'edited_dataset=wiktionary; path=/';
    renderSwitch();

    expect(await screen.findByTestId('edited-dataset-modified-note')).toHaveTextContent('English Wiktionary');
  });

  it('falls back to the active dataset when the chosen one is gone', async () => {
    document.cookie = 'edited_dataset=deleted_one; path=/';
    renderSwitch();

    await waitFor(() => expect(document.cookie).not.toContain('edited_dataset='));
    expect(
      within(screen.getByTestId('edited-dataset')).getByText('Vocab Bloom Hub English dataset'),
    ).toBeInTheDocument();
  });

  it('shows nothing without a session', () => {
    renderSwitch(null);
    expect(screen.queryByTestId('dataset-switch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edited-dataset')).not.toBeInTheDocument();
  });
});
