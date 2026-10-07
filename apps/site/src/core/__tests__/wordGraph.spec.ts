import type { PublicWordV1MeaningT, PublicWordV1T } from 'server/types';

import { buildWordGraph as buildGraph, GraphEntryT, wordNodeId } from '../wordGraph';

const meaning = (id: number, synonyms: string[], antonyms: string[] = []): PublicWordV1MeaningT =>
  ({ id, title: `sense ${id}`, definition: `definition ${id}`, synonyms, antonyms }) as PublicWordV1MeaningT;
const entry = (id: number, meanings: PublicWordV1MeaningT[]): PublicWordV1T =>
  ({ id, word: 'run', part_of_speech: 'verb', meanings }) as PublicWordV1T;

const buildWordGraph = (word: string, entries: GraphEntryT[], neighbors?: Map<string, GraphEntryT[]>) =>
  buildGraph(word, entries, 'verb', neighbors);

describe('word graph', () => {
  it('places private relations below their meaning and shared words at the junction', () => {
    const graph = buildWordGraph('run', [
      entry(1, [
        meaning(1, ['sprint', 'race', 'dash'], ['walk']),
        meaning(2, ['compete', 'race', 'dash'], ['withdraw']),
      ]),
    ]);
    const node = (label: string) => graph.nodes.find((item) => item.label === label)!;
    for (const [owner, words] of [
      ['sense 1', ['sprint', 'walk']],
      ['sense 2', ['compete', 'withdraw']],
    ] as const) {
      for (const word of words) {
        expect(node(word).x).toBe(node(owner).x);
        expect(node(word).y).toBeGreaterThan(node(owner).y);
      }
    }
    for (const word of ['race', 'dash']) {
      expect(node(word).x).toBe((node('sense 1').x + node('sense 2').x) / 2);
    }
    expect(node('race').y).not.toBe(node('dash').y);
    for (const a of graph.nodes) {
      for (const b of graph.nodes) {
        if (a.id === b.id) continue;
        expect(Math.abs(a.x - b.x) >= 180 || Math.abs(a.y - b.y) >= 76).toBe(true);
      }
    }
  });

  it('joins repeated words without collapsing meanings or relation kinds', () => {
    const graph = buildWordGraph('run', [
      entry(1, [meaning(1, ['sprint', 'sprint']), meaning(2, [], ['sprint'])]),
    ]);
    expect(graph.nodes.filter((node) => node.kind === 'meaning')).toHaveLength(2);
    expect(graph.nodes.filter((node) => node.label === 'sprint')).toHaveLength(1);
    expect(graph.nodes.find((node) => node.label === 'sprint')).toMatchObject({ shared: true, lane: 1 });
    expect(graph.edges.filter((edge) => edge.to === wordNodeId('sprint')).map((edge) => edge.kind)).toEqual([
      'synonym',
      'antonym',
    ]);
    expect(graph.direct).toEqual(['sprint']);
  });

  it('keeps homographs with different case and entries with distinct senses separate', () => {
    const graph = buildWordGraph('run', [
      entry(1, [meaning(1, ['Polish', 'polish'])]),
      entry(2, [meaning(1, ['polish'])]),
    ]);
    expect(graph.direct).toEqual(['Polish', 'polish']);
    expect(graph.nodes.filter((node) => node.kind === 'meaning')).toHaveLength(2);
  });

  it('expands direct neighbors once, joins cycles, and never expands second-level words', () => {
    const graph = buildWordGraph(
      'run',
      [entry(1, [meaning(1, ['sprint'])])],
      new Map([
        ['sprint', [entry(2, [meaning(1, ['run', 'dash'])])]],
        ['dash', [entry(3, [meaning(1, ['forbidden-third-level'])])]],
      ]),
    );
    expect(graph.nodes.filter((node) => node.label === 'run')).toHaveLength(1);
    expect(graph.nodes.find((node) => node.label === 'dash')).toMatchObject({ depth: 2 });
    expect(graph.nodes.find((node) => node.label === 'forbidden-third-level')).toBeUndefined();
    expect(graph.direct).toEqual(['sprint']);
    expect(
      graph.edges.every(
        (edge) =>
          graph.nodes.some((node) => node.id === edge.to) && graph.nodes.some((node) => node.id === edge.from),
      ),
    ).toBe(true);
  });

  it('bounds dense dictionaries and marks the partial view', () => {
    const many = Array.from({ length: 100 }, (_, i) => `neighbor ${i}`);
    const graph = buildWordGraph(
      'run',
      [entry(1, [meaning(1, many)])],
      new Map(
        many.map((word, i) => [
          word,
          [
            entry(i + 2, [
              meaning(
                1,
                many.map((value) => `${word} ${value}`),
              ),
            ]),
          ],
        ]),
      ),
    );
    expect(graph.direct).toHaveLength(24);
    expect(graph.nodes.length).toBeLessThanOrEqual(150);
    expect(graph.truncated).toBe(true);
    expect(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it('handles empty words and meanings without fabricating relations', () => {
    const graph = buildWordGraph('empty', []);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toEqual([]);
    expect(graph.direct).toEqual([]);
  });
});

it('isolates both root and neighboring meanings by part of speech and flows downwards', () => {
  const verb = entry(1, [meaning(1, ['race'])]);
  const noun = { ...entry(2, [meaning(2, ['competition'])]), part_of_speech: 'noun' } as PublicWordV1T;
  const neighbors = new Map([
    [
      'race',
      [
        entry(3, [meaning(3, ['dash'])]),
        { ...entry(4, [meaning(4, ['contest'])]), part_of_speech: 'noun' } as PublicWordV1T,
      ],
    ],
  ]);
  const verbs = buildGraph('run', [verb, noun], 'verb', neighbors);
  expect(verbs.direct).toEqual(['race']);
  expect(verbs.nodes.map((node) => node.label)).toEqual(expect.arrayContaining(['run', 'race', 'dash']));
  expect(verbs.nodes.some((node) => ['competition', 'contest'].includes(node.label))).toBe(false);
  for (const edge of verbs.edges) {
    expect(verbs.nodes.find((node) => node.id === edge.to)!.y).toBeGreaterThan(
      verbs.nodes.find((node) => node.id === edge.from)!.y,
    );
  }
  const nouns = buildGraph('run', [verb, noun], 'noun', neighbors);
  expect(nouns.direct).toEqual(['competition']);
  expect(nouns.nodes.some((node) => ['race', 'dash', 'contest'].includes(node.label))).toBe(false);
});

it('joins translations by language and spelling, preserves definitions, and excludes other parts', () => {
  const translated = (id: number, language: string, title: string, definition: string) =>
    ({
      id,
      language,
      title,
      definition,
      variants_of_words: [],
    }) as PublicWordV1MeaningT['translations'][number];
  const entries = [
    entry(1, [
      {
        ...meaning(1, ['sprint']),
        translations: [translated(1, 'ru', 'бежать', 'Первое пояснение'), translated(2, 'fr', 'courir', '')],
      },
      { ...meaning(2, ['race']), translations: [translated(3, 'ru', 'бежать', 'Второе пояснение')] },
    ]),
    {
      ...entry(2, [{ ...meaning(3, []), translations: [translated(4, 'ru', 'забег', '')] }]),
      part_of_speech: 'noun',
    } as PublicWordV1T,
  ];
  const graph = buildGraph(
    'run',
    entries,
    'verb',
    new Map([['sprint', [entry(3, [meaning(4, ['dash'])])]]]),
    'ru',
  );
  const translations = graph.nodes.filter((node) => node.kind === 'translation');
  expect(translations).toHaveLength(1);
  expect(translations[0]).toMatchObject({
    label: 'бежать',
    language: 'ru',
    shared: true,
    detail: 'Первое пояснение\nВторое пояснение',
  });
  expect(graph.direct).toEqual([]);
  expect(graph.edges.filter((edge) => edge.kind === 'translation')).toHaveLength(2);
  expect(graph.nodes.some((node) => ['sprint', 'dash', 'courir', 'забег'].includes(node.label))).toBe(false);
  expect(
    buildGraph('run', entries, 'verb', new Map(), 'de').nodes.filter((node) => node.kind === 'translation'),
  ).toEqual([]);
});

it('shows every translation variant, joins repeats and falls back to the title only without variants', () => {
  const translation = (title: string, variants_of_words: string[]) =>
    ({
      id: 1,
      language: 'ru',
      title,
      definition: 'Пояснение',
      variants_of_words,
    }) as PublicWordV1MeaningT['translations'][number];
  const graph = buildGraph(
    'run',
    [
      entry(1, [
        {
          ...meaning(1, []),
          translations: [translation('Двигаться быстро', ['бежать', ' мчаться ', 'бежать', ' '])],
        },
        {
          ...meaning(2, []),
          translations: [translation('', ['мчаться', 'нестись']), translation('работать', [])],
        },
      ]),
    ],
    'verb',
    new Map(),
    'ru',
  );
  expect(graph.nodes.filter((node) => node.kind === 'translation').map((node) => node.label)).toEqual([
    'бежать',
    'мчаться',
    'нестись',
    'работать',
  ]);
  expect(graph.nodes.find((node) => node.label === 'мчаться')).toMatchObject({ shared: true });
  expect(graph.edges.filter((edge) => edge.kind === 'translation')).toHaveLength(5);
});
