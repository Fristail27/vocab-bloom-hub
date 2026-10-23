/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { WordSearch } from './index';
import en from '../../../messages/en';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('@/core/apiBase', () => ({ browserApiBase: () => '/api' }));
jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const answer = {
  data: [
    {
      word: { word: 'ornithologist', part_of_speech: 'noun' },
      meaning: { id: 7, title: 'bird scientist', definition: 'A scientist who studies birds.', modified: true },
      score: 0.9,
    },
  ],
  meta: { dataset: { dataset: 'wordnet', title: 'WordNet', attribution: 'Test author', license: 'CC0' } },
};

describe('separate meaning search mode', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;
  const previousFetch = globalThis.fetch;
  let enabled: boolean;
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/word');
    enabled = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/status') ? { data: { enabled } } : answer),
    }));
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = previousFetch;
  });
  const render = async (strict = false) => {
    const content = (
      <NextIntlClientProvider locale="en" messages={en}>
        <WordSearch initialTerm="bird scientist" />
      </NextIntlClientProvider>
    );
    await act(async () => root.render(strict ? <React.StrictMode>{content}</React.StrictMode> : content));
  };
  const submit = async () => {
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  it('hides the mode when disabled and does not silently turn a restored meaning query into lexical search', async () => {
    enabled = false;
    window.history.replaceState(null, '', '/en/word?mode=meaning&q=bird+scientist');
    await render();
    expect(container.textContent).not.toContain('By meaning');
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Meaning search is unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('restores the exact semantic query/dataset and shows the matching sense and terms', async () => {
    window.history.replaceState(null, '', '/en/word?mode=meaning&q=bird+scientist&dataset=wordnet');
    await render();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/search/semantic?query=bird+scientist&limit=20&dataset=wordnet',
    );
    expect(container.querySelector('ul a')!.getAttribute('href')).toBe('/word/ornithologist?dataset=wordnet');
    expect(container.textContent).toContain('A scientist who studies birds.');
    expect(container.textContent).toContain('Test author');
    expect(container.textContent).toContain('Modified on this instance');
  });
  it('keeps inference failures separate and calls lexical search only after explicit mode selection', async () => {
    await render();
    await act(async () => {
      (container.querySelectorAll('input[name="search-mode"]')[1] as HTMLInputElement).click();
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await submit();
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Meaning search is unavailable');
    expect(fetchMock.mock.calls.filter((c) => c[0].includes('/search?'))).toHaveLength(0);
    expect(window.location.search).toContain('mode=meaning');
    await act(async () => {
      (container.querySelectorAll('input[name="search-mode"]')[0] as HTMLInputElement).click();
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], meta: { fuzzy: false } }) });
    await submit();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/search?search=bird+scientist&limit=20');
    expect(window.location.search).not.toContain('mode=');
  });
  it('restores a meaning query once after StrictMode replays the mount effect', async () => {
    window.history.replaceState(null, '', '/en/word?mode=meaning&q=birds');
    await render(true);
    expect(container.textContent).toContain('A scientist who studies birds.');
    expect(fetchMock.mock.calls.filter((c) => c[0].includes('/semantic?'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter((c) => c[0].includes('/search?'))).toHaveLength(0);
  });
  it('refuses a restored multi-dataset meaning query instead of dropping targets', async () => {
    window.history.replaceState(null, '', '/en/word?mode=meaning&q=birds&datasets=default&datasets=wordnet');
    await render();
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Meaning search is unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
