import { AbstractBaseApi } from '@/core/api/AbstractBaseApi';
import { downloadJsonl, toJsonl } from '../jsonl';

// jsdom's Blob has no text(); read it the FileReader way
const blobText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

describe('jsonl', () => {
  it('serializes one object per line with a trailing newline', () => {
    expect(toJsonl([{ word: 'a', synonyms: ['b'] }, { word: 'c' }])).toBe(
      '{"word":"a","synonyms":["b"]}\n{"word":"c"}\n',
    );
    expect(toJsonl([])).toBe('\n');
  });

  it('hands the file to the browser through saveBlobAsFile', async () => {
    const spy = jest.spyOn(AbstractBaseApi, 'saveBlobAsFile').mockImplementation(() => {});
    downloadJsonl([{ word: 'a' }], 'out.jsonl');

    expect(spy).toHaveBeenCalledWith(expect.any(Blob), 'out.jsonl');
    const blob = spy.mock.calls[0][0];
    expect(blob.type).toBe('application/x-ndjson;charset=utf-8');
    expect(await blobText(blob)).toBe('{"word":"a"}\n');
    spy.mockRestore();
  });
});
