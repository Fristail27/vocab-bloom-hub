import { present, missing } from '../compare';
import { ReconciliationDependencies } from '../dependencies';
import { ReconciliationValueT } from '../../../../../../types/reconciliation';

const article = (headword: string, parts: ReconciliationValueT = {}, alternatives: string[] = []) => ({
  headword,
  result: present({ parts, alternatives }),
});
const id = '00000000-0000-4000-8000-000000000001';
const word = (values = {}) => ({ common: {}, forms: {}, meanings: {}, ...values });
const meaning = (synonyms: string[] = [], antonyms: string[] = []) => ({ synonyms, antonyms });
async function* rows<T>(values: T[]) {
  yield* values;
}

describe('reconciliation reference index', () => {
  it('reads endpoints once and accepts form-only targets across pages without rescanning articles', async () => {
    const items = Array.from({ length: 205 }, (_, i) =>
      article(`word${i}`, {
        noun: word({ meanings: { [id]: meaning(['forms']) } }),
      }),
    );
    items.push(article('last', { noun: word({ forms: { [id]: { word: 'forms' } } }) }));
    const stream = rows(items);
    const reads = jest.spyOn(stream, 'next');
    const graph = await ReconciliationDependencies.read(stream);
    const count = reads.mock.calls.length;
    for (const item of items) expect(graph.problems(item)).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(count);
    expect(count).toBe(items.length + 1);
  });

  it('requires reciprocal alternatives on both articles and forms, and gives articles precedence', async () => {
    const a = article('a', { noun: word() }, ['as']);
    const b = article('b', { noun: word({ forms: { [id]: { word: 'as', alternatives: ['a'] } } }) });
    let graph = await ReconciliationDependencies.read(rows([a, b]));
    expect(graph.problems(a)).toEqual([]);
    expect(graph.problems(b)).toEqual([]);
    graph = await ReconciliationDependencies.read(rows([a, b, article('as', { noun: word() })]));
    expect(graph.problems(a)).toEqual(['as']);
    const unreciprocated = article('b', { noun: word({ forms: { [id]: { word: 'as' } } }) });
    graph = await ReconciliationDependencies.read(rows([a, unreciprocated]));
    expect(graph.problems(a)).toEqual(['as']);
  });

  it('flags missing, deleted and self references, but accepts a surviving form of a deleted headword', async () => {
    const a = article('a', { noun: word({ meanings: { [id]: meaning(['gone', 'a'], ['missing']) } }) });
    const gone = { headword: 'gone', result: missing };
    let graph = await ReconciliationDependencies.read(rows([a, gone]));
    expect(graph.isDeleted('gone')).toBe(true);
    expect(graph.isDeleted('missing')).toBe(false);
    expect(graph.problems(a)).toEqual(['gone', 'a', 'missing']);
    expect(graph.problems(gone)).toEqual([]);
    graph = await ReconciliationDependencies.read(
      rows([a, gone, article('other', { noun: word({ forms: { [id]: { word: 'gone' } } }) })]),
    );
    expect(graph.problems(a)).toEqual(['a', 'missing']);
  });

  it('checks phrasal base parts of speech and cycles, including cycles farther up the chain', async () => {
    const verb = (name: string, base: string) =>
      article(name, {
        verb: word({ common: { base_phrasal: base } }),
      });
    const items = [
      verb('a', 'b'),
      verb('b', 'c'),
      verb('c', 'b'),
      verb('self', 'self'),
      verb('form', 'forms'),
      verb('wrong', 'noun'),
      article('noun', {
        noun: word({ forms: { [id]: { word: 'forms' } } }),
      }),
    ];
    const graph = await ReconciliationDependencies.read(rows(items));
    expect(items.slice(0, 6).map((item) => graph.problems(item))).toEqual([
      ['b'],
      ['b'],
      ['c'],
      ['self'],
      ['forms'],
      ['noun'],
    ]);
  });
});
