import { renderToStaticMarkup } from 'react-dom/server';
import type { OriginT } from 'server/types';
import { Origins } from '.';

const translate = jest.fn((key: string, _values?: Record<string, unknown>) => key);
jest.mock('next-intl', () => ({ useTranslations: () => translate }));

it('renders source terms once with all recorded acquisitions', () => {
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
  const html = renderToStaticMarkup(<Origins origins={[source]} />);
  expect(html.match(/<summary>/g)).toHaveLength(1);
  expect(html.match(/CC-BY-4.0/g)).toHaveLength(1);
  expect(html.match(/Example editors/g)).toHaveLength(1);
  expect(html.match(/Keep this notice\./g)).toHaveLength(1);
  expect(html).toContain('<p>fork</p>');
  expect(html).toContain('<p>copy</p>');
  expect(html).toContain('2026-10-02');
  expect(html).toContain('2026-10-03');
  expect(translate).toHaveBeenCalledWith('copy', { name: 'Intermediate fork', version: 'unknown_version' });
});
