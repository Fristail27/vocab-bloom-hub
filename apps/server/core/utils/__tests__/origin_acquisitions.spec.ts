import { inheritOrigin } from '../origin_acquisitions';
import { datasetOrigin, licensesOf } from '../provenance';
import type { OriginAcquisitionT, OriginT } from '../../../types/provenance';

const source = datasetOrigin({
  name: 'example',
  source: 'example',
  own: true,
  title: 'Example glossary',
  version: '2',
  license: 'CC-BY-4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Example editors',
  attribution_url: 'https://example.org/glossary',
  notice: 'Keep this notice.',
});
const event: OriginAcquisitionT = {
  id: 'fork-1',
  method: 'fork',
  recorded_at: '2026-10-03T12:00:00.000Z',
  revision: '10:10:',
};

it('adds acquisition events to the existing snapshot without duplicating terms or mutating the source', () => {
  const previous = structuredClone(source);
  const copied: OriginAcquisitionT = {
    id: 'copy-1',
    method: 'copy',
    recorded_at: null,
    revision: 'word-revision',
  };
  const first = inheritOrigin([source], { ...source, id: 'another-snapshot-id' }, event);
  const next = inheritOrigin(first.origins, { ...source, id: 'yet-another-id' }, copied);
  expect(next.origins).toEqual([{ ...source, acquisitions: [event, copied] }]);
  expect(next.origin.id).toBe(source.id);
  expect(licensesOf(next.origins)).toEqual(licensesOf([source]));
  expect(first.origins).toEqual([{ ...source, acquisitions: [event] }]);
  expect(source).toEqual(previous);
});

it('matches JSONB snapshots regardless of object property order', () => {
  const reordered = {
    ...Object.fromEntries(Object.entries(source).reverse()),
    licenses: source.licenses.map((license) => Object.fromEntries(Object.entries(license).reverse())),
  } as OriginT;
  expect(inheritOrigin([reordered], { ...source, id: 'new' }, event).origins).toHaveLength(1);
});

it.each(['dataset', 'manual'] as const)(
  'keeps a transfer through an own dataset without adding its license (%s origin)',
  (method) => {
    const original = { ...source, method };
    const intermediate = { ...source, id: 'intermediate', name: 'My fork', version: '3' };
    const result = inheritOrigin([original], intermediate, event, false);
    expect(licensesOf(result.origins)).toEqual(licensesOf([original]));
    expect(result.origins).toHaveLength(1);
    expect(result.origins[0].acquisitions).toEqual([
      { ...event, via: { name: 'My fork', version: '3', url: source.url } },
    ]);
    expect(original.acquisitions).toBeUndefined();
  },
);

it.each<Partial<OriginT>>([
  { name: 'Another glossary' },
  { version: '3' },
  { url: 'https://example.org/another' },
  { record_url: 'https://example.org/word' },
  { attribution: 'Other editors' },
  { licenses: [{ ...source.licenses[0], text: 'Additional supplied terms.' }] },
  { license_relation: 'any' },
  { notices: ['Different notice.'] },
  { scope: 'dataset' },
  { recorded_at: '2026-10-02T12:00:00.000Z' },
  { method: 'manual', inherited: false },
])('preserves a distinct source declaration: %j', (difference) => {
  const earlier = { ...source, ...difference, id: 'earlier' };
  const result = inheritOrigin([earlier], source, event);
  expect(result.origins).toEqual([
    { ...earlier, inherited: true },
    { ...source, acquisitions: [event] },
  ]);
});
