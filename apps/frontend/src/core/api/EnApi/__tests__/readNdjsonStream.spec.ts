import { ErrorCodes } from 'server/core/constants/error_codes';
import { ImportDictionaryChunkT } from 'server/types';
import { AbstractBaseApi } from '../../AbstractBaseApi';
import { EnApi } from '../index';

// EnApi.importDictionary drives the private readNdjsonStream, which is the unit under test here
const makeReader = (chunks: string[]) => {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    read: async () =>
      index < chunks.length
        ? { done: false as const, value: encoder.encode(chunks[index++]) }
        : { done: true as const, value: undefined },
  } as ReadableStreamDefaultReader<Uint8Array>;
};

const collectChunks = async (streamChunks: string[]) => {
  jest.spyOn(AbstractBaseApi, 'stream').mockResolvedValue(makeReader(streamChunks));
  const received: ImportDictionaryChunkT[] = [];
  const onError = jest.fn();
  const res = await EnApi.importDictionary('0.0.1', (c) => received.push(c), onError);
  return { res, received, onError };
};

describe('EnApi NDJSON stream parsing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('парсит несколько строк из одного чанка', async () => {
    const { res, received, onError } = await collectChunks([
      '{"stage":"parsing","percent":10}\n{"stage":"parsing","percent":20}\n',
    ]);

    expect(res).toEqual({ success: true });
    expect(received).toEqual([
      { stage: 'parsing', percent: 10 },
      { stage: 'parsing', percent: 20 },
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('буферизует строку, разрезанную посередине между чанками', async () => {
    const { res, received, onError } = await collectChunks([
      '{"stage":"parsing","per',
      'cent":42}\n{"stage":"comp',
      'leted","percent":100}\n',
    ]);

    expect(res).toEqual({ success: true });
    expect(received).toEqual([
      { stage: 'parsing', percent: 42 },
      { stage: 'completed', percent: 100 },
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('дожёвывает последнюю строку без завершающего \\n', async () => {
    const { received } = await collectChunks(['{"stage":"parsing","percent":10}\n{"stage":"completed"}']);

    expect(received).toEqual([{ stage: 'parsing', percent: 10 }, { stage: 'completed' }]);
  });

  it('пропускает пустые строки', async () => {
    const { received, onError } = await collectChunks(['\n\n{"stage":"completed"}\n\n']);

    expect(received).toEqual([{ stage: 'completed' }]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('репортит unparsed_data для битой JSON-строки и продолжает', async () => {
    const { res, received, onError } = await collectChunks(['not-json\n{"stage":"completed"}\n']);

    expect(res).toEqual({ success: true });
    expect(received).toEqual([{ stage: 'completed' }]);
    expect(onError).toHaveBeenCalledWith(ErrorCodes.unparsed_data);
  });

  it('возвращает failed_fetch, если чтение потока падает', async () => {
    const reader = {
      read: async () => {
        throw new Error('connection reset');
      },
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    jest.spyOn(AbstractBaseApi, 'stream').mockResolvedValue(reader);

    const res = await EnApi.importDictionary('0.0.1', jest.fn(), jest.fn());

    expect(res).toEqual({ error: true, message: ErrorCodes.failed_fetch });
  });

  it('прокидывает ошибку stream() без чтения', async () => {
    jest.spyOn(AbstractBaseApi, 'stream').mockResolvedValue({ error: true, message: ErrorCodes.failed_fetch });

    const handleChunk = jest.fn();
    const res = await EnApi.importDictionary('0.0.1', handleChunk, jest.fn());

    expect(res).toEqual({ error: true, message: ErrorCodes.failed_fetch });
    expect(handleChunk).not.toHaveBeenCalled();
  });

  it('разбивает многобайтовые UTF-8 символы на границе чанков без порчи текста', async () => {
    const encoder = new TextEncoder();
    const line = '{"stage":"parsing","word":"словарь"}\n';
    const bytes = encoder.encode(line);
    // split in the middle of a Cyrillic character (2 bytes each)
    const splitAt = line.indexOf('о') + 24;
    const reader = (() => {
      const parts = [bytes.slice(0, splitAt), bytes.slice(splitAt)];
      let i = 0;
      return {
        read: async () =>
          i < parts.length
            ? { done: false as const, value: parts[i++] }
            : { done: true as const, value: undefined },
      } as ReadableStreamDefaultReader<Uint8Array>;
    })();
    jest.spyOn(AbstractBaseApi, 'stream').mockResolvedValue(reader);

    const received: ImportDictionaryChunkT[] = [];
    const res = await EnApi.importDictionary('0.0.1', (c) => received.push(c), jest.fn());

    expect(res).toEqual({ success: true });
    expect(received).toEqual([{ stage: 'parsing', word: 'словарь' } as unknown as ImportDictionaryChunkT]);
  });
});
