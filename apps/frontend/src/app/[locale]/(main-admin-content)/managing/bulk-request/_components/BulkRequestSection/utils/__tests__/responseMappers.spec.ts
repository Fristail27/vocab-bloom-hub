import { ResponseMapperIdE } from '../../types';
import {
  extractText,
  formatResponsePath,
  MapperError,
  parseFirstJson,
  parseResponsePath,
  responseMappers,
  toResultLine,
} from '../responseMappers';

const identity = { word: 'abandon', part_of_speech: 'verb' };
// no response path: the mappers auto-detect the model text
const AUTO: (string | number)[] = [];

const response = (json: unknown, text = JSON.stringify(json)) => ({ status: 200, json, text });

describe('extractText', () => {
  it('finds the model text in the popular API shapes', () => {
    expect(extractText(response({ choices: [{ message: { content: 'openai' } }] }))).toBe('openai');
    expect(extractText(response({ content: [{ type: 'text', text: 'anthropic' }] }))).toBe('anthropic');
    expect(extractText(response({ candidates: [{ content: { parts: [{ text: 'gemini' }] } }] }))).toBe(
      'gemini',
    );
    expect(extractText(response({ output_text: 'responses' }))).toBe('responses');
    expect(extractText(response({ output: [{ content: [{ type: 'output_text', text: 'resp-2' }] }] }))).toBe(
      'resp-2',
    );
    expect(extractText(response({ message: { content: 'ollama' } }))).toBe('ollama');
    expect(extractText(response({ response: 'ollama-gen' }))).toBe('ollama-gen');
  });

  it('falls back to the raw body text', () => {
    expect(extractText(response('plain string'))).toBe('plain string');
    expect(extractText({ status: 200, json: undefined, text: 'not json at all' })).toBe('not json at all');
  });
});

describe('parseFirstJson', () => {
  it('prefers a fenced block, then the widest object / array span', () => {
    expect(parseFirstJson('Sure!\n```json\n{"synonyms": ["desert"]}\n```\nBye')).toEqual({
      synonyms: ['desert'],
    });
    expect(parseFirstJson('Here you go: {"a": 1, "b": {"c": 2}} thanks')).toEqual({ a: 1, b: { c: 2 } });
    expect(parseFirstJson('list: ["x", "y"]')).toEqual(['x', 'y']);
    expect(parseFirstJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('throws a MapperError when the text holds no JSON', () => {
    expect(() => parseFirstJson('no json here')).toThrow(MapperError);
  });
});

describe('responseMappers', () => {
  it('json_in_text extracts the JSON answer of a chat completion', () => {
    const res = response({
      choices: [{ message: { content: 'Answer:\n{"synonyms": ["desert", "forsake"]}' } }],
    });
    expect(responseMappers[ResponseMapperIdE.json_in_text](res, AUTO)).toEqual({
      synonyms: ['desert', 'forsake'],
    });
  });

  it('json_body returns the parsed body and rejects non-JSON responses', () => {
    expect(responseMappers[ResponseMapperIdE.json_body](response({ ok: 1 }), AUTO)).toEqual({ ok: 1 });
    expect(() =>
      responseMappers[ResponseMapperIdE.json_body]({ status: 200, json: undefined, text: 'x' }, AUTO),
    ).toThrow(MapperError);
  });

  it('text wraps the model text', () => {
    expect(responseMappers[ResponseMapperIdE.text](response({ output_text: 'hello' }), AUTO)).toEqual({
      text: 'hello',
    });
  });

  describe('with a response path', () => {
    // a shape none of the auto-detected paths know
    const res = response({
      data: { items: [{ answer: '{"synonyms": ["leave"]}', meta: { score: 0.9 } }, { answer: 'second' }] },
    });

    it('json_in_text parses the JSON inside the string found at the path', () => {
      expect(responseMappers[ResponseMapperIdE.json_in_text](res, ['data', 'items', 0, 'answer'])).toEqual({
        synonyms: ['leave'],
      });
    });

    it('json_in_text and json_body return a non-string value at the path as is', () => {
      expect(responseMappers[ResponseMapperIdE.json_in_text](res, ['data', 'items', 0, 'meta'])).toEqual({
        score: 0.9,
      });
      expect(responseMappers[ResponseMapperIdE.json_body](res, ['data', 'items', 1])).toEqual({
        answer: 'second',
      });
    });

    it('text keeps a string at the path and serializes anything else', () => {
      expect(responseMappers[ResponseMapperIdE.text](res, ['data', 'items', 1, 'answer'])).toEqual({
        text: 'second',
      });
      expect(responseMappers[ResponseMapperIdE.text](res, ['data', 'items', 0, 'meta'])).toEqual({
        text: '{"score":0.9}',
      });
    });

    it('fails with a MapperError naming the path when nothing is there or the body is not JSON', () => {
      expect(() => responseMappers[ResponseMapperIdE.json_body](res, ['data', 'missing'])).toThrow(
        /nothing found at the response path "data\.missing"/,
      );
      expect(() =>
        responseMappers[ResponseMapperIdE.json_in_text]({ status: 200, json: undefined, text: 'plain' }, ['a']),
      ).toThrow(MapperError);
    });
  });
});

describe('parseResponsePath', () => {
  it('accepts dotted, bracketed and JSONPath-like spellings', () => {
    expect(parseResponsePath('')).toEqual([]);
    expect(parseResponsePath('  $ ')).toEqual([]);
    expect(parseResponsePath('choices[0].message.content')).toEqual(['choices', 0, 'message', 'content']);
    expect(parseResponsePath('choices.0.message.content')).toEqual(['choices', 0, 'message', 'content']);
    expect(parseResponsePath('$.data["odd key"][\'x.y\'][2]')).toEqual(['data', 'odd key', 'x.y', 2]);
    expect(parseResponsePath('output_text')).toEqual(['output_text']);
  });

  it('rejects malformed paths', () => {
    expect(parseResponsePath('choices[')).toBeNull();
    expect(parseResponsePath('choices[a]')).toBeNull();
    expect(parseResponsePath('a..b')).toBeNull();
    expect(parseResponsePath('a.')).toBeNull();
    expect(parseResponsePath('a."b')).toBeNull();
  });

  it('formats a path back for error messages', () => {
    expect(formatResponsePath(['choices', 0, 'message', 'content'])).toBe('choices[0].message.content');
  });
});

describe('toResultLine', () => {
  it('merges an object payload next to the row identity', () => {
    expect(toResultLine(identity, { synonyms: ['desert'] })).toEqual({
      word: 'abandon',
      part_of_speech: 'verb',
      synonyms: ['desert'],
    });
    expect(toResultLine({ ...identity, meaning_id: 5 }, { ok: true })).toEqual({
      word: 'abandon',
      part_of_speech: 'verb',
      meaning_id: 5,
      ok: true,
    });
  });

  it('nests a non-object payload under result', () => {
    expect(toResultLine(identity, ['a', 'b'])).toEqual({
      word: 'abandon',
      part_of_speech: 'verb',
      result: ['a', 'b'],
    });
    expect(toResultLine(identity, 'text')).toEqual({ word: 'abandon', part_of_speech: 'verb', result: 'text' });
  });
});
