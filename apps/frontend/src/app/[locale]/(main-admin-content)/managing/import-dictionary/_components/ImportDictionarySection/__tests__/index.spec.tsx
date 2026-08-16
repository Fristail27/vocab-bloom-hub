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
  (EnApi.importDictionary as jest.Mock).mockImplementation(async (handleChunk: HandleChunkT) => {
    chunks.forEach(handleChunk);
    return result;
  });
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
    expect(EnApi.importDictionary).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(screen.queryByText('start_importing')).not.toBeInTheDocument();
    expect(screen.queryByText('retry_importing')).not.toBeInTheDocument();
  });

  it('показывает версию датасета из manifest-чанка и обновляет установленную после успеха', async () => {
    mockImportStreaming([
      {
        stage: EnDictionaryImportPhasesE.downloading_database,
        percent: 0,
        datasetVersion: '0.2.0',
      } as ImportDictionaryChunkT,
      { stage: EnDictionaryImportPhasesE.completed, percent: 100 } as ImportDictionaryChunkT,
    ]);

    renderSection();
    expect(screen.getByText(/your_version: —/)).toBeInTheDocument();
    expect(screen.getByText(/latest_version: —/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('start_importing'));

    await screen.findByText(/latest_version: 0\.2\.0/);
    // после успешного импорта установленная версия равна версии манифеста
    expect(screen.getByText(/your_version: 0\.2\.0/)).toBeInTheDocument();
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
