import { buildRequestBody, listPlaceholders, renderTemplate } from '../renderTemplate';

const vars = { word: 'give up', part_of_speech: 'verb', description: 'say "no"' };

describe('renderTemplate', () => {
  it('substitutes known placeholders and leaves unknown ones visible', () => {
    expect(
      renderTemplate('{{word}} / {{ part_of_speech }} / {{missing}}', { word: 'run', part_of_speech: 'verb' }),
    ).toBe('run / verb / {{missing}}');
  });

  it('renders arrays as comma lists and empty values as empty strings', () => {
    expect(
      renderTemplate('[{{categories}}] [{{word_level}}]', { categories: ['a', 'b'], word_level: null }),
    ).toBe('[a, b] []');
  });

  it('escapes substituted text as a JSON string body when asked', () => {
    const out = renderTemplate('{"p": "{{text}}"}', { text: 'say "hi"\nnow' }, { jsonEscape: true });
    expect(JSON.parse(out)).toEqual({ p: 'say "hi"\nnow' });
  });

  it('lists the placeholders a template references once each', () => {
    expect(listPlaceholders('{{word}} {{word}} {{prompt}}')).toEqual(['word', 'prompt']);
  });
});

describe('buildRequestBody', () => {
  it('renders the prompt, injects it JSON-escaped and returns compact valid JSON', () => {
    const body = buildRequestBody(
      '{"messages": [{"role": "user", "content": "{{prompt}}"}], "tag": "{{word}}"}',
      'Synonyms for the {{part_of_speech}} "{{word}}" ({{description}})',
      vars,
    );
    expect(JSON.parse(body)).toEqual({
      messages: [{ role: 'user', content: 'Synonyms for the verb "give up" (say "no")' }],
      tag: 'give up',
    });
  });

  it('throws when the rendered body is not valid JSON', () => {
    expect(() => buildRequestBody('{"a": {{word}}}', 'x', vars)).toThrow(SyntaxError);
  });
});
