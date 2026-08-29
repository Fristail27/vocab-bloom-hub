import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ImportStatusT, ImportTriggerE } from 'server/types';
import { EnDictionaryImportPhasesE } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { getImportStatus: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { AutoImportBanner, DISMISSED_STORAGE_KEY } from '../index';

describe('AutoImportBanner (issue #268)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    (EnApi.getImportStatus as jest.Mock).mockResolvedValue({ running: false });
  });

  it('shows the progress of the automatic import', () => {
    const status: ImportStatusT = {
      running: true,
      trigger: ImportTriggerE.auto,
      stage: EnDictionaryImportPhasesE.saving_words,
      percent: 37.4,
    };
    render(<AutoImportBanner status={status} />);
    expect(screen.getByTestId('import-banner-running')).toHaveTextContent(
      'auto_import_running {"stage":"en_saving_0","percent":"37"}',
    );
  });

  it('names the download stage without a percent', () => {
    render(
      <AutoImportBanner
        status={{
          running: true,
          trigger: ImportTriggerE.auto,
          stage: EnDictionaryImportPhasesE.downloading_database,
        }}
      />,
    );
    expect(screen.getByTestId('import-banner-running')).toHaveTextContent('auto_import_downloading');
  });

  it('shows a failed automatic import with the way out', () => {
    render(<AutoImportBanner status={{ running: false, trigger: ImportTriggerE.auto, error: 'HTTP 502' }} />);
    expect(screen.getByTestId('import-banner-failed')).toHaveTextContent(
      'auto_import_failed {"error":"HTTP 502"}',
    );
  });

  it('shows the completed automatic import with its version', async () => {
    render(
      <AutoImportBanner
        status={{ running: false, trigger: ImportTriggerE.auto, percent: 100, dataset_version: '1.2.3' }}
      />,
    );
    expect(await screen.findByTestId('import-banner-completed')).toHaveTextContent(
      'auto_import_completed {"version":"1.2.3"}',
    );
  });

  it('stays closed across page loads once dismissed, and comes back for a later import', async () => {
    const done = {
      running: false,
      trigger: ImportTriggerE.auto,
      percent: 100,
      finished_at: '2026-08-30T10:00:00.000Z',
    };
    const { unmount } = render(<AutoImportBanner status={done} />);
    const banner = await screen.findByTestId('import-banner-completed');
    fireEvent.click(banner.querySelector('.ant-alert-close-icon') as Element);
    expect(window.localStorage.getItem(DISMISSED_STORAGE_KEY)).toBe(done.finished_at);
    unmount();

    // a "page load" with the same import: nothing
    render(<AutoImportBanner status={done} />);
    await act(async () => {});
    expect(screen.queryByTestId('import-banner-completed')).toBeNull();

    // the next import has another finished_at: shown again
    render(<AutoImportBanner status={{ ...done, finished_at: '2026-08-31T10:00:00.000Z' }} />);
    expect(await screen.findByTestId('import-banner-completed')).toBeInTheDocument();
  });

  it('reports a manual import from another session while it runs, and nothing once it ended', () => {
    const { rerender } = render(
      <AutoImportBanner
        status={{
          running: true,
          trigger: ImportTriggerE.manual,
          stage: EnDictionaryImportPhasesE.saving_phrases,
          percent: 80,
        }}
      />,
    );
    expect(screen.getByTestId('import-banner-running')).toHaveTextContent('manual_import_running');
    rerender(<AutoImportBanner status={{ running: false, trigger: ImportTriggerE.manual, percent: 100 }} />);
    expect(screen.queryByTestId('import-banner-running')).toBeNull();
    expect(screen.queryByTestId('import-banner-completed')).toBeNull();
  });

  it('renders nothing while the status is unknown and polls the server', async () => {
    const { container } = render(<AutoImportBanner />);
    expect(container).toBeEmptyDOMElement();
    expect(EnApi.getImportStatus).toHaveBeenCalledTimes(1);
  });
});
