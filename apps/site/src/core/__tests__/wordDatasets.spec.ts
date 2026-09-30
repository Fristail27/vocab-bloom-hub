import type { PublicHeadwordV1ResT, PublicWordDatasetV1T, PublicWordV1T } from 'server/types';

import { OWN_DATASET_TERMS } from '../datasetTerms';
import { datasetTitle, defaultPanel, groupTitle, UNNAMED_DATASET, wordPanels } from '../wordDatasets';
import { panelOfGroup } from '../wordPanel';

const entry = (id: number, word: string): PublicWordV1T => ({ id, word }) as PublicWordV1T;

const headword = (word: string, entries: PublicWordV1T[], variants: string[] = []): PublicHeadwordV1ResT =>
  ({ data: entries, meta: { word, count: entries.length, variants } }) as PublicHeadwordV1ResT;

const group = (overrides: Partial<PublicWordDatasetV1T>): PublicWordDatasetV1T => ({
  dataset: 'default',
  active: false,
  source: 'vocab-bloom-hub',
  dataset_version: null,
  license: 'CC-BY-4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: '',
  attribution_url: null,
  notice: '',
  license_text: '',
  word: 'run',
  variants: [],
  count: overrides.entries?.length ?? 0,
  entries: [],
  ...overrides,
});

const WIKTIONARY_TERMS = { ...OWN_DATASET_TERMS, source: 'wiktionary', license: 'CC-BY-SA-4.0' };

// issue #538: a tab per dataset that holds the headword
describe('wordPanels', () => {
  it('puts the dataset of the project first, Wiktionary second, the others in the order of the instance', () => {
    const panels = wordPanels({
      headword: headword('run', [entry(9, 'run')]),
      terms: { ...OWN_DATASET_TERMS, source: 'wordnet' },
      groups: [
        group({ dataset: 'wordnet_princeton', source: 'princeton-wordnet', entries: [entry(4, 'run')] }),
        group({ dataset: 'wordnet', active: true, source: 'wordnet', entries: [entry(9, 'run')] }),
        group({ dataset: 'wiktionary', source: 'wiktionary', entries: [entry(1, 'run')] }),
        group({ dataset: 'default', entries: [entry(7, 'run')] }),
      ],
    });

    expect(panels.map(({ dataset, active }) => [dataset, active])).toEqual([
      ['default', false],
      ['wiktionary', false],
      ['wordnet_princeton', false],
      ['wordnet', true],
    ]);
    expect(panels.map((panel) => panel.title)).toEqual([
      'Vocab Bloom Hub English dataset',
      'English Wiktionary',
      'Princeton WordNet 3.1',
      'Open English WordNet',
    ]);
    // the page without a parameter is the first tab, whichever dataset the instance serves
    expect(defaultPanel(panels)?.dataset).toBe('default');
  });

  it('opens Wiktionary for a headword the dataset of the project does not hold', () => {
    const panels = wordPanels({
      headword: headword('run', [entry(9, 'run')]),
      terms: { ...OWN_DATASET_TERMS, source: 'wordnet' },
      groups: [
        group({ dataset: 'wordnet', active: true, source: 'wordnet', entries: [entry(9, 'run')] }),
        group({ dataset: 'wiktionary', source: 'wiktionary', entries: [entry(1, 'run')] }),
        group({ dataset: 'default', entries: [] }),
      ],
    });

    expect(panels.map((panel) => panel.dataset)).toEqual(['wiktionary', 'wordnet']);
    expect(defaultPanel(panels)?.dataset).toBe('wiktionary');
  });

  it('never mixes the datasets: a panel has the entries, the spelling and the terms of its own', () => {
    const [served, other] = wordPanels({
      headword: headword('Polish', [entry(1, 'Polish')], ['polish']),
      terms: WIKTIONARY_TERMS,
      groups: [
        group({ dataset: 'wiktionary', active: true, entries: [entry(1, 'Polish')] }),
        group({
          dataset: 'wordnet_princeton',
          source: 'princeton-wordnet',
          license: 'WordNet',
          license_text: 'WordNet Release 3.1',
          word: 'polish',
          entries: [entry(4, 'polish')],
        }),
      ],
    });

    expect(served).toEqual(
      expect.objectContaining({ word: 'Polish', variants: ['polish'], terms: WIKTIONARY_TERMS }),
    );
    expect(served.entries.map(({ id }) => id)).toEqual([1]);
    expect(other).toEqual(expect.objectContaining({ word: 'polish', variants: [] }));
    expect(other.entries.map(({ id }) => id)).toEqual([4]);
    expect(other.terms).toEqual(
      expect.objectContaining({
        source: 'princeton-wordnet',
        license: 'WordNet',
        license_text: 'WordNet Release 3.1',
      }),
    );
  });

  it('leaves out a dataset that does not hold the headword', () => {
    const panels = wordPanels({
      headword: headword('run', [entry(1, 'run')]),
      terms: OWN_DATASET_TERMS,
      groups: [
        group({ dataset: 'default', active: true, entries: [entry(1, 'run')] }),
        group({ dataset: 'wordnet', entries: [] }),
      ],
    });

    expect(panels.map((panel) => panel.dataset)).toEqual(['default']);
  });

  it('shows the served dataset when the read of every dataset gave nothing', () => {
    const panels = wordPanels({
      headword: headword('run', [entry(1, 'run')]),
      terms: OWN_DATASET_TERMS,
      groups: [],
    });

    expect(panels).toEqual([
      expect.objectContaining({
        title: 'Vocab Bloom Hub English dataset',
        dataset: UNNAMED_DATASET,
        active: true,
        word: 'run',
        terms: OWN_DATASET_TERMS,
      }),
    ]);
  });

  it('is the page of the other datasets for a headword the served one does not hold', () => {
    const panels = wordPanels({
      headword: null,
      terms: WIKTIONARY_TERMS,
      groups: [
        group({ dataset: 'wiktionary', active: true, entries: [] }),
        group({ dataset: 'wordnet', entries: [entry(9, 'footrace')], word: 'footrace' }),
      ],
    });

    expect(panels.map(({ dataset, active, word }) => [dataset, active, word])).toEqual([
      ['wordnet', false, 'footrace'],
    ]);
    expect(defaultPanel(panels)?.dataset).toBe('wordnet');
  });

  it('has no panel for a headword no dataset holds', () => {
    expect(wordPanels({ headword: null, terms: OWN_DATASET_TERMS, groups: [] })).toEqual([]);
    expect(defaultPanel([])).toBeUndefined();
  });
});

describe('datasetTitle', () => {
  it('names a dataset of the catalog by its title and any other by its name', () => {
    expect(datasetTitle('wordnet_princeton')).toBe('Princeton WordNet 3.1');
    expect(datasetTitle('a_later_one')).toBe('a_later_one');
  });
});

// issue #540: a dataset of the instance's own is in no catalog, the instance names it
describe('groupTitle', () => {
  it('takes the title the instance gives a dataset, the catalog’s from an instance that sends none', () => {
    expect(groupTitle({ dataset: 'my_words', title: 'My words' })).toBe('My words');
    expect(groupTitle({ dataset: 'wiktionary' })).toBe('English Wiktionary');
  });

  it('names the tab of a dataset of the owner’s by its title', () => {
    const panels = wordPanels({
      headword: headword('run', [entry(9, 'run')]),
      terms: OWN_DATASET_TERMS,
      groups: [
        group({ dataset: 'default', active: true, entries: [entry(9, 'run')] }),
        group({ dataset: 'my_words', title: 'My words', source: 'my_words', entries: [entry(3, 'run')] }),
      ],
    });
    expect(panels.map((panel) => [panel.dataset, panel.title])).toEqual([
      ['default', 'Vocab Bloom Hub English dataset'],
      ['my_words', 'My words'],
    ]);
  });
});

// the browser makes the panel of a tab from the group it has read
describe('panelOfGroup', () => {
  it('keeps what the group says and takes the title the page gave the tab', () => {
    const panel = panelOfGroup(
      group({
        dataset: 'wiktionary',
        active: true,
        source: 'wiktionary',
        license: 'CC-BY-SA-4.0',
        word: 'Polish',
        variants: ['polish'],
        entries: [entry(1, 'Polish')],
      }),
      'English Wiktionary',
    );

    expect(panel).toEqual(
      expect.objectContaining({
        dataset: 'wiktionary',
        title: 'English Wiktionary',
        active: true,
        word: 'Polish',
        variants: ['polish'],
      }),
    );
    expect(panel.terms).toEqual(expect.objectContaining({ source: 'wiktionary', license: 'CC-BY-SA-4.0' }));
    expect(panel.entries.map(({ id }) => id)).toEqual([1]);
  });
});
