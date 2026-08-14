import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { EnWordFormsE, EnPartOfSpeechE, EnWordT } from 'server/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockMessage = { error: jest.fn(), success: jest.fn() };

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('antd', () => {
  const ReactLib: typeof React = jest.requireActual('react');
  type ChildrenP = { children?: React.ReactNode; onClick?: () => void; content?: React.ReactNode };
  return {
    App: { useApp: () => ({ message: mockMessage }) },
    Button: ({ children, onClick }: ChildrenP) => ReactLib.createElement('button', { onClick }, children),
    // render popover content inline so the delete button is reachable in the test
    Popover: ({ children, content }: ChildrenP) => ReactLib.createElement('div', null, children, content),
    Tag: ({ children }: ChildrenP) => ReactLib.createElement('span', null, children),
    Typography: { Text: ({ children }: ChildrenP) => ReactLib.createElement('span', null, children) },
  };
});

jest.mock('@ant-design/icons', () => ({
  EditOutlined: () => null,
  DeleteOutlined: () => null,
}));

jest.mock('@/core/ui/Input', () => {
  const ReactLib: typeof React = jest.requireActual('react');
  return {
    Input: ({ value, onChange }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) =>
      ReactLib.createElement('input', { value, onChange }),
  };
});

jest.mock('@/core/hooks', () => ({
  useDebounced: (value: string) => value,
}));

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { search: jest.fn(), deleteWord: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { SearchModule } from '../index';

const makeWord = (id: number, word: string): EnWordT =>
  ({
    id,
    word,
    part_of_speech: EnPartOfSpeechE.verb,
    form_of_word: EnWordFormsE.base_form,
    forms: [],
  }) as unknown as EnWordT;

describe('SearchModule (issue #176)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const typeSearch = async (value: string) => {
    const input = container.querySelector('input');
    if (!input) throw new Error('input not found');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      valueSetter?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const getDeleteButtons = () =>
    [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('delete_word'));

  it('убирает слово из списка после успешного удаления', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([makeWord(1, 'run'), makeWord(2, 'jump')]);
    (EnApi.deleteWord as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      root.render(<SearchModule />);
    });
    await typeSearch('ru');

    expect(container.textContent).toContain('run');
    expect(container.textContent).toContain('jump');

    await act(async () => {
      getDeleteButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(EnApi.deleteWord).toHaveBeenCalledWith(1);
    expect(mockMessage.success).toHaveBeenCalled();
    expect(container.textContent).not.toContain('run');
    expect(container.textContent).toContain('jump');
  });

  it('оставляет слово в списке, если удаление вернуло ошибку', async () => {
    (EnApi.search as jest.Mock).mockResolvedValue([makeWord(1, 'run')]);
    (EnApi.deleteWord as jest.Mock).mockResolvedValue({ error: true, message: 'some_error' });

    await act(async () => {
      root.render(<SearchModule />);
    });
    await typeSearch('ru');

    await act(async () => {
      getDeleteButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockMessage.error).toHaveBeenCalled();
    expect(container.textContent).toContain('run');
  });
});
