import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { EnApi } from '@/core/api/EnApi';
import { CopyWordPicker, CopyPreviewT } from '../CopyWordPicker';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/components/EditedDataset', () => ({
  useEditedDataset: () => ({
    edited: { name: 'mine', own: true },
    datasets: [
      { name: 'original', title: 'Original' },
      { name: 'mine', title: 'Mine' },
    ],
  }),
}));
jest.mock('@/core/api/EnApi', () => ({ EnApi: { searchDataset: jest.fn(), previewCopy: jest.fn() } }));

it('cannot copy the previous selection while the next preview is loading', async () => {
  const onCopy = jest.fn();
  jest.mocked(EnApi.searchDataset).mockResolvedValue([
    { id: 1, word: 'first', part_of_speech: 'noun', form_of_word: 'base_form' },
    { id: 2, word: 'second', part_of_speech: 'noun', form_of_word: 'base_form' },
  ] as Awaited<ReturnType<typeof EnApi.searchDataset>>);
  const first = { id: 1, word: 'first', meanings: [] } as unknown as CopyPreviewT;
  const second = { id: 2, word: 'second', meanings: [] } as unknown as CopyPreviewT;
  let resolve!: (value: CopyPreviewT) => void;
  jest
    .mocked(EnApi.previewCopy)
    .mockResolvedValueOnce(first)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  render(
    <App>
      <CopyWordPicker onCopy={onCopy} />
    </App>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'prefill' }));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'source' }));
  fireEvent.click(await screen.findByText('Original'));
  const search = screen.getByRole('searchbox', { name: 'search' });
  fireEvent.change(search, { target: { value: 'word' } });
  fireEvent.keyDown(search, { key: 'Enter', code: 'Enter', keyCode: 13 });
  fireEvent.click(await screen.findByRole('button', { name: 'first · noun' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'use_word' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'second · noun' }));
  expect(screen.getByRole('button', { name: 'use_word' })).toBeDisabled();
  expect(onCopy).not.toHaveBeenCalled();
  await act(async () => resolve(second));
  fireEvent.click(screen.getByRole('button', { name: 'use_word' }));
  expect(onCopy).toHaveBeenCalledWith(second);
});
