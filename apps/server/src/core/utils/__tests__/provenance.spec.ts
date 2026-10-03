import { assertOriginsEdit, validOrigins } from '../provenance';
import type { OriginT } from '../../../../types';

const origin: OriginT = {
  id: 'source',
  name: 'Example',
  version: '1',
  method: 'dataset',
  scope: 'word',
  recorded_at: null,
  attribution: 'Example editors',
  notices: [],
  license_relation: 'all',
  inherited: true,
  licenses: [{ spdx: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }],
  acquisitions: [{ id: 'fork', method: 'fork', recorded_at: '2026-10-03T12:00:00.000Z', revision: '10:10:' }],
};

it('accepts completed acquisitions and a copy preview whose timestamp is not yet known', () => {
  expect(validOrigins([origin])).toBe(true);
  expect(
    validOrigins([{ ...origin, acquisitions: [{ id: 'preview', method: 'copy', recorded_at: null }] }]),
  ).toBe(true);
});

it.each([
  null,
  {},
  [{ id: '', method: 'fork', recorded_at: null }],
  [{ id: 'event', method: 'manual', recorded_at: null }],
  [{ id: 'event', method: 'fork', recorded_at: 'invalid' }],
  [{ id: 'event', method: 'fork', recorded_at: null, revision: '' }],
  [origin.acquisitions![0], origin.acquisitions![0]],
])('rejects malformed acquisition metadata: %j', (acquisitions) => {
  expect(validOrigins([{ ...origin, acquisitions }])).toBe(false);
});

it('rejects events on manual declarations and duplicate event identities across sources', () => {
  expect(validOrigins([{ ...origin, inherited: false }])).toBe(false);
  expect(validOrigins([{ ...origin, method: 'manual' }])).toBe(false);
  expect(validOrigins([origin, { ...origin, id: 'another-source' }])).toBe(false);
});

it('accepts an inherited manual source transferred through an identified dataset and protects the event', () => {
  const acquired: OriginT = {
    ...origin,
    method: 'manual',
    acquisitions: [
      {
        ...origin.acquisitions![0],
        via: { name: 'Intermediate fork', version: null, url: 'https://example.org/fork' },
      },
    ],
  };
  expect(validOrigins([acquired])).toBe(true);
  expect(validOrigins([{ ...acquired, inherited: false }])).toBe(false);
  expect(() => assertOriginsEdit([acquired], [{ ...acquired, acquisitions: [] }])).toThrow(
    'provenance_inherited',
  );
  for (const via of [
    null,
    {},
    { name: '', version: null },
    { name: 'Fork', version: '' },
    { name: 'Fork', version: '1', url: 'javascript:alert(1)' },
  ]) {
    expect(validOrigins([{ ...origin, acquisitions: [{ ...origin.acquisitions![0], via }] }])).toBe(false);
  }
});

it('protects recorded acquisition events when editing inherited origins', () => {
  expect(() => assertOriginsEdit([origin], [structuredClone(origin)])).not.toThrow();
  expect(() => assertOriginsEdit([origin], [{ ...origin, acquisitions: [] }])).toThrow('provenance_inherited');
  expect(() =>
    assertOriginsEdit(
      [origin],
      [{ ...origin, acquisitions: [{ ...origin.acquisitions![0], revision: 'changed' }] }],
    ),
  ).toThrow('provenance_inherited');
});
