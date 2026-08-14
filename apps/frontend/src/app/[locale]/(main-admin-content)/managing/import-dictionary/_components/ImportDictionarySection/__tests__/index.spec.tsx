import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { ImportDictionaryChunkT } from 'server/types';
import { EnDictionaryImportPhasesE } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { importDictionary: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { ImportDictionarySection } from '../index';

type HandleChunkT = (c: ImportDictionaryChunkT) => void;

const mockImportStreaming = (chunks: ImportDictionaryChunkT[], result: unknown = { success: true }) => {
  (EnApi.importDictionary as jest.Mock).mockImplementation(
    async (_version: string, handleChunk: HandleChunkT) => {
      chunks.forEach(handleChunk);
      return result;
    },
  );
};

const renderSection = () =>
  render(
    <App>
      <ImportDictionarySection />
    </App>,
  );

describe('ImportDictionarySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('доводит прогресс до 100% и прячет кнопку после успешного импорта', async () => {
    mockImportStreaming([
      { stage: EnDictionaryImportPhasesE.saving_words, percent: 40 } as ImportDictionaryChunkT,
      { stage: EnDictionaryImportPhasesE.completed, percent: 100 } as ImportDictionaryChunkT,
    ]);

    renderSection();
    fireEvent.click(screen.getByText('start_importing'));

    await screen.findByText('100.00%');
    expect(EnApi.importDictionary).toHaveBeenCalledWith('0.0.1', expect.any(Function), expect.any(Function));
    expect(screen.queryByText('start_importing')).not.toBeInTheDocument();
    expect(screen.queryByText('retry_importing')).not.toBeInTheDocument();
  });

  it('показывает ошибку и кнопку повтора, если импорт вернул error-юнион', async () => {
    mockImportStreaming([], { error: true, message: 'failed_fetch' });

    renderSection();
    fireEvent.click(screen.getByText('start_importing'));

    await screen.findByText('retry_importing');
    await screen.findByText('failed_fetch'); // error toast with the passthrough translation key
  });

  it('считает импорт ошибочным, если стрим закончился без чанка completed', async () => {
    mockImportStreaming([
      { stage: EnDictionaryImportPhasesE.saving_words, percent: 70 } as ImportDictionaryChunkT,
    ]);

    renderSection();
    fireEvent.click(screen.getByText('start_importing'));

    await screen.findByText('retry_importing');
    await waitFor(() => expect(screen.getByText('unknown_error')).toBeInTheDocument());
  });
});
