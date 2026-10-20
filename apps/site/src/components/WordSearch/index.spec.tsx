/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { WordSearch } from './index';
import en from '../../../messages/en';
import ar from '../../../messages/ar';
import ru from '../../../messages/ru';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/core/apiBase', () => ({ browserApiBase: () => '/api' }));
jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const hit = (id: number) => ({ id, word: `word${id}`, part_of_speech: 'noun' });
const response = (count: number, fuzzy = false, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 503,
    json: async () => ({ data: Array.from({ length: count }, (_, i) => hit(i)), meta: { fuzzy } }),
  }) as Response;

describe('WordSearch status', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  });
  const render = async (locale = 'en', messages = en) => {
    await act(async () =>
      root.render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          <WordSearch initialTerm="run" />
        </NextIntlClientProvider>,
      ),
    );
  };
  const submit = async () => {
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };
  const status = () => container.querySelector('[role="status"]')!;

  it('keeps an empty live region mounted, announces loading and results, and preserves focus', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    await render();
    const region = status();
    expect(region.textContent).toBe('');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();
    const button = container.querySelector('button')!;
    button.focus();
    await submit();
    expect(status()).toBe(region);
    expect(region.textContent).toBe('Searching…');
    expect(container.querySelector('form')!.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(response(2)));
    expect(region.textContent).toBe('2 results shown.');
    expect(region.querySelector('ul')).toBeNull();
    expect(container.querySelectorAll('ul a')).toHaveLength(2);
    expect(container.querySelector('form')!.getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('announces empty results, HTTP and network errors, and fuzzy recovery', async () => {
    fetchMock
      .mockResolvedValueOnce(response(0))
      .mockResolvedValueOnce(response(0, false, false))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(1, true));
    await render();
    for (const expected of [
      'Nothing found.',
      'The dictionary did not answer.',
      'The dictionary did not answer.',
      '1 result shown. No exact match — these are the closest spellings.',
    ]) {
      await submit();
      expect(status().textContent).toBe(expected);
      expect(container.querySelector('form')!.getAttribute('aria-busy')).toBe('false');
    }
  });

  it.each([
    ['ar', ar, 1, 'تُعرض نتيجة واحدة.'],
    ['ar', ar, 2, 'تُعرض نتيجتان.'],
    ['ru', ru, 1, 'Показан 1 результат.'],
    ['ru', ru, 2, 'Показано 2 результата.'],
    ['ru', ru, 5, 'Показано 5 результатов.'],
  ] as const)('renders localized result counts (%s)', async (locale, messages, count, expected) => {
    fetchMock.mockResolvedValue(response(count));
    await render(locale, messages);
    await submit();
    expect(status().textContent).toBe(expected);
  });

  it('announces completion for a restored query', async () => {
    window.history.replaceState(null, '', '/?q=run');
    fetchMock.mockResolvedValue(response(1));
    await render();
    expect(status().textContent).toBe('1 result shown.');
  });
  it('restores a selected dictionary and links to its exact word tab', async () => {
    window.history.replaceState(null, '', '/en/word?q=run&dataset=wordnet');
    fetchMock.mockResolvedValue(response(1));
    await render();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search?search=run&limit=20&dataset=wordnet');
    expect(container.querySelector('ul a')!.getAttribute('href')).toBe('/word/word0?dataset=wordnet');
  });

  it('keeps equal local IDs in separate groups and never calls a failed group empty', async () => {
    window.history.replaceState(null, '', '/en/word?q=run&datasets=default&datasets=wordnet');
    const group = (dataset: string) => ({
      dataset,
      title: dataset,
      attribution: dataset,
      license: 'CC0',
      status: 'ok',
      data: [hit(1)],
      meta: { page: 1, limit: 20, has_more: false, fuzzy: false },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [group('default'), group('wordnet')], meta: { datasets: 2, partial: false } }),
    });
    await render();
    expect(container.querySelectorAll('section')).toHaveLength(2);
    expect([...container.querySelectorAll('ul a')].map((a) => a.getAttribute('href'))).toEqual([
      '/word/word1?dataset=default',
      '/word/word1?dataset=wordnet',
    ]);
    expect(status().textContent).toBe('2 results shown.');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            ...group('wordnet'),
            status: 'unavailable',
            data: undefined,
            meta: undefined,
            error: 'dataset_unavailable',
          },
        ],
        meta: { datasets: 1, partial: true },
      }),
    });
    await submit();
    expect(status().textContent).toBe('Some dictionaries could not be searched.');
    expect(container.querySelector('section')!.textContent).toContain('This dictionary could not be searched.');
    expect(container.textContent).not.toContain('Nothing found.');
  });
});
