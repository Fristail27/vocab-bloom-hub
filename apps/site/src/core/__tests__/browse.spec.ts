import { BROWSE_PAGE_SIZE, browsePage, browsePath, bucketOf, bucketSummaries, parsePage } from '../browse';

const index = (words: string[]) => ({ words, lastModified: null, builtAt: 0 });

describe('the browse index (issue #480)', () => {
  it('buckets a headword by its first Latin letter, everything else under "other"', () => {
    expect(bucketOf('Run')).toBe('r');
    expect(bucketOf('give up')).toBe('g');
    expect(bucketOf('3D')).toBe('other');
    expect(bucketOf('éclair')).toBe('other');
    expect(bucketOf('')).toBe('other');
  });

  it('summarizes the buckets that have words, in alphabetical order, with their page counts', () => {
    const words = ['zoo', 'apple', ...Array.from({ length: BROWSE_PAGE_SIZE + 1 }, (_, i) => `b${i}`), '42'];

    expect(bucketSummaries(index(words))).toEqual([
      { bucket: 'a', count: 1, pages: 1 },
      { bucket: 'b', count: BROWSE_PAGE_SIZE + 1, pages: 2 },
      { bucket: 'z', count: 1, pages: 1 },
      { bucket: 'other', count: 1, pages: 1 },
    ]);
  });

  it('pages a bucket and answers null past the end or for an unknown bucket', () => {
    const words = Array.from({ length: BROWSE_PAGE_SIZE + 5 }, (_, i) => `a${String(i).padStart(3, '0')}`);
    const idx = index(words);

    expect(browsePage(idx, 'a', 1)).toMatchObject({ page: 1, pages: 2, count: BROWSE_PAGE_SIZE + 5 });
    expect(browsePage(idx, 'a', 1)?.words).toHaveLength(BROWSE_PAGE_SIZE);
    expect(browsePage(idx, 'a', 2)?.words).toEqual(['a200', 'a201', 'a202', 'a203', 'a204']);
    expect(browsePage(idx, 'a', 3)).toBeNull();
    expect(browsePage(idx, 'a', 0)).toBeNull();
    expect(browsePage(idx, 'b', 1)).toBeNull();
    expect(browsePage(idx, 'A', 1)).toBeNull();
  });

  it('parses the page segment strictly and builds the route without a segment for the first page', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('1')).toBe(1);
    expect(parsePage('12')).toBe(12);
    expect(parsePage('0')).toBeNull();
    expect(parsePage('-1')).toBeNull();
    expect(parsePage('2abc')).toBeNull();
    expect(browsePath('a')).toBe('/word/browse/a');
    expect(browsePath('a', 1)).toBe('/word/browse/a');
    expect(browsePath('other', 3)).toBe('/word/browse/other/3');
  });
});
