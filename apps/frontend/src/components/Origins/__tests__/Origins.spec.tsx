import { fireEvent, render, screen } from '@testing-library/react';
import type { OriginT } from 'server/types';
import { Origins } from '..';

const translate = jest.fn((key: string, _values?: Record<string, unknown>) => key);
jest.mock('next-intl', () => ({ useTranslations: () => translate }));

it('shows the source licenses once with both acquisition events in its details', () => {
  const source: OriginT = {
    id: 'source',
    name: 'Example glossary',
    version: '2',
    attribution: 'Example editors',
    licenses: [{ spdx: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://example.org/license' }],
    license_relation: 'all',
    notices: ['Keep this notice.'],
    scope: 'word',
    method: 'dataset',
    inherited: true,
    recorded_at: null,
    acquisitions: [
      { id: 'fork', method: 'fork', recorded_at: '2026-10-02T12:00:00.000Z' },
      {
        id: 'copy',
        method: 'copy',
        recorded_at: '2026-10-03T12:00:00.000Z',
        via: { name: 'Intermediate fork', version: null, url: 'https://example.org/fork' },
      },
    ],
  };
  render(<Origins origins={[source]} />);
  fireEvent.click(screen.getByRole('button', { name: /Example glossary/ }));
  expect(screen.getAllByRole('link', { name: 'CC-BY-4.0' })).toHaveLength(1);
  expect(screen.getAllByText('Example editors')).toHaveLength(1);
  expect(screen.getAllByText('Keep this notice.')).toHaveLength(1);
  expect(screen.getByText('fork')).toBeInTheDocument();
  expect(screen.getByText('copy')).toBeInTheDocument();
  expect(screen.getByText('2026-10-02')).toBeInTheDocument();
  expect(screen.getByText('2026-10-03')).toBeInTheDocument();
  expect(translate).toHaveBeenCalledWith('copy', { name: 'Intermediate fork', version: 'unknown_version' });
});
