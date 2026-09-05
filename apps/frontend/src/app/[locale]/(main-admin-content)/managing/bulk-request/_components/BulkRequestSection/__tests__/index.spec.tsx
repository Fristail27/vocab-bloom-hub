import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnMeaningListItemT,
  EnMeaningTranslationListItemT,
  EnPartOfSpeechE,
  EnShortTranslationListItemT,
  EnWordListItemT,
  PaginatedListT,
} from 'server/types';

jest.mock('next-intl', () => ({
  // the keys are asserted, interpolation values are appended for the counters
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: {
    listWords: jest.fn(),
    listMeanings: jest.fn(),
    listMeaningTranslations: jest.fn(),
    listShortTranslations: jest.fn(),
  },
}));

import { EnApi } from '@/core/api/EnApi';
import { AbstractBaseApi } from '@/core/api/AbstractBaseApi';
import { BulkRequestSection } from '../index';

const makeItem = (id: number, word: string): EnWordListItemT => ({
  id,
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  area_variant: EnAreaVariantsE.common,
  word_level: null,
  language_register: null,
  generated: false,
  generated_by_model: null,
  version: '1',
  is_obsolete: false,
  transcription: null,
  description: null,
  categories: [],
  meanings_count: 0,
  short_translations_count: 0,
});

const makeMeaning = (id: number, word: string, title: string): EnMeaningListItemT => ({
  id,
  word_id: id,
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  title,
  definition: `to ${title}`,
  sort_order: 0,
  area_variant: EnAreaVariantsE.common,
  meaning_level: null,
  language_register: null,
  categories: [],
  is_obsolete: false,
  examples: [],
  synonyms: [],
  antonyms: [],
  translations_count: 0,
});

const makeTranslation = (id: number, word: string, title: string): EnMeaningTranslationListItemT => ({
  id,
  meaning_id: id + 100,
  word_id: id + 200,
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  meaning_title: `meaning of ${word}`,
  meaning_definition: `to ${word}`,
  language: AvailableTranslationLanguagesE.ru,
  title,
  definition: `${title} (def)`,
  variants_of_words: [],
});

const makeShortTranslation = (id: number, word: string, description: string): EnShortTranslationListItemT => ({
  id,
  word_id: id + 300,
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  language: AvailableTranslationLanguagesE.ru,
  description,
  variants_of_words: [],
});

const page = <T,>(items: T[], total = items.length): PaginatedListT<T> => ({
  items,
  page: 1,
  limit: 50,
  total,
  has_more: false,
});

// jsdom has no Response; the code only needs ok / status / text() / headers.get()
const fakeResponse = (status: number, body: string) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: () => null },
  }) as unknown as Response;

const chatAnswer = (synonyms: string[]) =>
  fakeResponse(200, JSON.stringify({ choices: [{ message: { content: JSON.stringify({ synonyms }) } }] }));

// jsdom's Blob has no text(); read it the FileReader way
const blobText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

const renderSection = () =>
  render(
    <App>
      <BulkRequestSection />
    </App>,
  );

const setValue = (testId: string, value: string) => {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
};

// fills the request step and moves on to the words step
const goToWords = async (url: string) => {
  setValue('bulk-url', url);
  fireEvent.click(screen.getByTestId('bulk-next'));
  await screen.findByText('abandon');
};

describe('BulkRequestSection', () => {
  const words = [makeItem(1, 'abandon'), makeItem(2, 'abate'), makeItem(3, 'abide')];
  const meanings = [makeMeaning(11, 'abandon', 'leave'), makeMeaning(12, 'abandon', 'stop')];
  const translations = [makeTranslation(21, 'abandon', 'покидать')];
  const shortTranslations = [makeShortTranslation(31, 'abandon', 'покидать (кратко)')];
  let fetchMock: jest.Mock;
  let saveBlobSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (EnApi.listWords as jest.Mock).mockResolvedValue(page(words));
    (EnApi.listMeanings as jest.Mock).mockResolvedValue(page(meanings));
    (EnApi.listMeaningTranslations as jest.Mock).mockResolvedValue(page(translations));
    (EnApi.listShortTranslations as jest.Mock).mockResolvedValue(page(shortTranslations));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    saveBlobSpy = jest.spyOn(AbstractBaseApi, 'saveBlobAsFile').mockImplementation(() => {});
  });

  afterEach(() => {
    saveBlobSpy.mockRestore();
  });

  it('keeps the words step locked until a URL is entered, then shows the table', async () => {
    renderSection();

    // the words are loaded right away so the request preview can use the first one
    await waitFor(() => expect(EnApi.listWords).toHaveBeenCalledWith({ page: 1, limit: 50 }));
    await waitFor(() => expect(screen.getByTestId('bulk-preview').textContent).toContain('abandon'));
    // the URL is prefilled with the DeepSeek endpoint; an empty one locks the next step
    expect(screen.getByTestId('bulk-url')).toHaveValue('https://api.deepseek.com/chat/completions');
    setValue('bulk-url', '');
    expect(screen.getByTestId('bulk-next')).toBeDisabled();
    expect(screen.getByText('url_required')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-start')).not.toBeInTheDocument();

    setValue('bulk-url', 'https://api.example.com/v1');
    expect(screen.getByTestId('bulk-next')).toBeEnabled();
    fireEvent.click(screen.getByTestId('bulk-next'));

    await screen.findByText('abandon');
    expect(screen.getByTestId('bulk-start')).toBeDisabled();
    expect(screen.getByText('nothing_to_run')).toBeInTheDocument();

    // back to the settings step keeps the entered URL
    fireEvent.click(screen.getByTestId('bulk-back'));
    expect(screen.getByTestId('bulk-url')).toHaveValue('https://api.example.com/v1');
  });

  it('runs the filtered scope in the browser, sends one request per word and offers the jsonl download', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      // the default body: a fixed system message, the rendered prompt as the user message
      const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('language API service');
      const word = body.messages[1].content.match(/"([^"]+)"/)?.[1] ?? '?';
      return chatAnswer([`${word}-syn`]);
    });

    renderSection();
    setValue('bulk-api-key', 'secret-key');
    await goToWords('https://api.example.com/v1/chat/completions');
    fireEvent.click(screen.getByText('scope_filtered:3'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-results');
    expect(screen.getByTestId('bulk-status').textContent).toBe('status_done:3/3/3/0');

    // one external request per word, with the key in the Authorization header
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    // our own API only ever got the listing calls: the key never went there
    for (const call of (EnApi.listWords as jest.Mock).mock.calls) {
      expect(JSON.stringify(call)).not.toContain('secret-key');
    }

    fireEvent.click(screen.getByTestId('bulk-download-results'));
    expect(saveBlobSpy).toHaveBeenCalledWith(expect.any(Blob), 'vocab-bloom-hub-bulk-request-results.jsonl');
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    expect(
      text
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l)),
    ).toEqual([
      { word: 'abandon', part_of_speech: 'verb', synonyms: ['abandon-syn'] },
      { word: 'abate', part_of_speech: 'verb', synonyms: ['abate-syn'] },
      { word: 'abide', part_of_speech: 'verb', synonyms: ['abide-syn'] },
    ]);
  });

  it('collects failures separately and lets them be downloaded and retried', async () => {
    fetchMock
      .mockResolvedValueOnce(chatAnswer(['ok']))
      .mockResolvedValueOnce(fakeResponse(400, '{"error":"bad"}'))
      .mockResolvedValueOnce(fakeResponse(200, 'no json here'))
      // the retry of the two failed words
      .mockResolvedValue(chatAnswer(['fixed']));

    renderSection();
    setValue('bulk-concurrency', '1');
    await goToWords('https://api.example.com/v1');
    fireEvent.click(screen.getByText('scope_filtered:3'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-failures');
    expect(screen.getByTestId('bulk-status').textContent).toBe('status_done:3/3/1/2');
    expect(screen.getByText(/HTTP 400/)).toBeInTheDocument();
    // the default response path cannot be applied to a non-JSON body
    expect(screen.getByText(/mapper: the response body is not JSON/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-download-failures'));
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    const lines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { word: string; status?: number });
    expect(lines.map((l) => l.word)).toEqual(['abate', 'abide']);
    expect(lines[0].status).toBe(400);

    fireEvent.click(screen.getByText('retry_failed:2'));
    await waitFor(() => expect(screen.getByTestId('bulk-status').textContent).toBe('status_done:2/2/2/0'));
    // results of the first run are kept and the retried words were appended
    expect(screen.getByTestId('bulk-download-results').textContent).toBe('download_results:3');
  });

  it('cancels a run: no new requests are started after cancel', async () => {
    let release: () => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(chatAnswer(['x']));
        }),
    );

    renderSection();
    setValue('bulk-concurrency', '1');
    await goToWords('https://api.example.com/v1');
    fireEvent.click(screen.getByText('scope_filtered:3'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    const cancel = await screen.findByTestId('bulk-cancel');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(cancel);
    await act(async () => release());

    await waitFor(() => expect(screen.getByTestId('bulk-status').textContent).toMatch(/^status_cancelled:/));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hides the filters under a collapsed panel and shows them on demand', async () => {
    renderSection();
    await goToWords('https://api.example.com/v1');

    expect(screen.getByText('filters_panel')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('filters_panel'));
    await screen.findByTestId('filter-search');
  });

  it('switches the source table: loads meanings, swaps the default prompt and the placeholders, and traces lines by meaning_id', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      // the meanings prompt quotes the word first, then the meaning title
      const quoted = [...body.messages[1].content.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      return chatAnswer([`${quoted[1]}-syn`]);
    });

    renderSection();
    await waitFor(() => expect(EnApi.listWords).toHaveBeenCalled());
    expect(screen.getByTestId('bulk-placeholders').textContent).toContain('{{word_level}}');

    fireEvent.click(screen.getByTestId('bulk-source-meanings'));
    await waitFor(() => expect(EnApi.listMeanings).toHaveBeenCalledWith({ page: 1, limit: 50 }));
    // the untouched prompt follows the table; the placeholders now list the meaning columns
    expect((screen.getByTestId('bulk-prompt') as HTMLTextAreaElement).value).toContain(
      'in the meaning "{{title}}"',
    );
    expect(screen.getByTestId('bulk-placeholders').textContent).toContain('{{definition}}');
    expect(screen.getByTestId('bulk-placeholders').textContent).not.toContain('{{word_level}}');
    // the preview is rendered for the first meaning
    await waitFor(() => expect(screen.getByTestId('bulk-preview').textContent).toContain('leave'));

    fireEvent.click(screen.getByTestId('bulk-next'));
    await screen.findByText('leave');
    fireEvent.click(screen.getByText('scope_filtered:2'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-results');
    expect(screen.getByTestId('bulk-status').textContent).toBe('status_done:2/2/2/0');
    // the filtered scope was collected through the meanings endpoint, not the words one
    expect(EnApi.listMeanings).toHaveBeenCalledWith({ page: 1, limit: 200 });
    expect(EnApi.listWords).not.toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));

    fireEvent.click(screen.getByTestId('bulk-download-results'));
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    expect(
      text
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l)),
    ).toEqual([
      { word: 'abandon', part_of_speech: 'verb', meaning_id: 11, synonyms: ['leave-syn'] },
      { word: 'abandon', part_of_speech: 'verb', meaning_id: 12, synonyms: ['stop-syn'] },
    ]);
  });

  it('runs over meaning translations with the translation fields in the prompt and ids in the lines', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      expect(body.messages[1].content).toContain('"ru"');
      expect(body.messages[1].content).toContain('"покидать"');
      expect(body.messages[1].content).toContain('"meaning of abandon"');
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content: '{"is_correct": true}' } }] }));
    });

    renderSection();
    fireEvent.click(screen.getByTestId('bulk-source-translations'));
    await waitFor(() => expect(EnApi.listMeaningTranslations).toHaveBeenCalledWith({ page: 1, limit: 50 }));
    fireEvent.click(screen.getByTestId('bulk-next'));
    await screen.findByText('покидать');
    fireEvent.click(screen.getByText('scope_filtered:1'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-results');
    fireEvent.click(screen.getByTestId('bulk-download-results'));
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    expect(JSON.parse(text.trim())).toEqual({
      word: 'abandon',
      part_of_speech: 'verb',
      meaning_id: 121,
      translation_id: 21,
      language: 'ru',
      is_correct: true,
    });
  });

  it('runs over short translations with the description in the prompt and ids in the lines', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      expect(body.messages[1].content).toContain('"ru"');
      expect(body.messages[1].content).toContain('"покидать (кратко)"');
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content: '{"is_correct": true}' } }] }));
    });

    renderSection();
    fireEvent.click(screen.getByTestId('bulk-source-short_translations'));
    await waitFor(() => expect(EnApi.listShortTranslations).toHaveBeenCalledWith({ page: 1, limit: 50 }));
    // the untouched prompt follows the table and the placeholders list the short translation columns
    expect((screen.getByTestId('bulk-prompt') as HTMLTextAreaElement).value).toContain('short translation');
    expect(screen.getByTestId('bulk-placeholders').textContent).toContain('{{description}}');
    fireEvent.click(screen.getByTestId('bulk-next'));
    await screen.findByText('покидать (кратко)');
    fireEvent.click(screen.getByText('scope_filtered:1'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-results');
    // the filtered scope was collected through the short translations endpoint
    expect(EnApi.listShortTranslations).toHaveBeenCalledWith({ page: 1, limit: 200 });
    fireEvent.click(screen.getByTestId('bulk-download-results'));
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    expect(JSON.parse(text.trim())).toEqual({
      word: 'abandon',
      part_of_speech: 'verb',
      short_translation_id: 31,
      language: 'ru',
      is_correct: true,
    });
  });

  it('reads the value to process from the response path and blocks an invalid path', async () => {
    // a response shape none of the auto-detected paths know
    fetchMock.mockResolvedValue(fakeResponse(200, JSON.stringify({ data: { answer: '{"x": 1}' } })));

    renderSection();
    await waitFor(() => expect(EnApi.listWords).toHaveBeenCalled());

    // prefilled with the chat-completions path
    expect(screen.getByTestId('bulk-response-path')).toHaveValue('choices[0].message.content');
    setValue('bulk-response-path', 'data[');
    expect(screen.getByTestId('bulk-next')).toBeDisabled();
    expect(screen.getAllByText('response_path_invalid').length).toBeGreaterThan(0);

    setValue('bulk-response-path', 'data.answer');
    expect(screen.getByTestId('bulk-next')).toBeEnabled();
    await goToWords('https://api.example.com/v1');
    fireEvent.click(screen.getByText('scope_filtered:3'));
    fireEvent.click(screen.getByTestId('bulk-start'));

    await screen.findByTestId('bulk-download-results');
    expect(screen.getByTestId('bulk-status').textContent).toBe('status_done:3/3/3/0');
    fireEvent.click(screen.getByTestId('bulk-download-results'));
    const text = await blobText(saveBlobSpy.mock.calls[0][0] as Blob);
    expect(JSON.parse(text.trim().split('\n')[0])).toEqual({ word: 'abandon', part_of_speech: 'verb', x: 1 });
  });
});
