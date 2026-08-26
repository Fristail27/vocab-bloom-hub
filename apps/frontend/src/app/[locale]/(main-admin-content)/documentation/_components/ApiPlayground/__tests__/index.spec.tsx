import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EnPartOfSpeechE, EnWordFormsE, EnSearchWordT } from 'server/types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => false;
    return t;
  },
}));

jest.mock('@/core/api/EnApi', () => ({
  // the playground runs against the public prefix and shows the v1 envelope
  EnApi: { publicSearch: jest.fn(), publicSearchDetailed: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { ApiEndpointKeyE, DOCUMENTED_ENDPOINTS } from '../../../constants';
import { ApiPlayground } from '../index';

const searchEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.search)!;

const makeWord = (id: number, word: string): EnSearchWordT =>
  ({
    id,
    word,
    part_of_speech: EnPartOfSpeechE.verb,
    form_of_word: EnWordFormsE.base_form,
    forms: [],
  }) as unknown as EnSearchWordT;

const typeSearch = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } });

const send = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'send_request' }));
  });
};

describe('ApiPlayground (issue #245)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('не даёт отправить запрос без обязательного параметра', () => {
    render(<ApiPlayground endpoint={searchEndpoint} />);

    expect(screen.getByRole('button', { name: 'send_request' })).toBeDisabled();

    typeSearch('run');

    expect(screen.getByRole('button', { name: 'send_request' })).toBeEnabled();
  });

  it('отправляет заполненные фильтры и показывает ответ в виде JSON', async () => {
    (EnApi.publicSearch as jest.Mock).mockResolvedValue({ data: [makeWord(1, 'run')], meta: { count: 1 } });

    render(<ApiPlayground endpoint={searchEndpoint} />);
    typeSearch('run');
    await send();

    expect(EnApi.publicSearch).toHaveBeenCalledWith({ search: 'run', limit: 10 });
    expect(screen.getByText(/"word": "run"/)).toBeInTheDocument();
    expect(screen.getByText(/"count": 1/)).toBeInTheDocument();
  });

  it('переключает ответ между JSON и таблицей', async () => {
    (EnApi.publicSearch as jest.Mock).mockResolvedValue({ data: [makeWord(1, 'run')], meta: { count: 1 } });

    render(<ApiPlayground endpoint={searchEndpoint} />);
    typeSearch('run');
    await send();

    fireEvent.click(screen.getByText('view_table'));

    expect(screen.queryByText(/"word": "run"/)).not.toBeInTheDocument();
    // the horizontally scrollable table renders its header twice
    expect(screen.getAllByText('col_word').length).toBeGreaterThan(0);
    expect(screen.getAllByText('run').length).toBeGreaterThan(0);
  });

  it('показывает ошибку сервера вместо ответа', async () => {
    (EnApi.publicSearch as jest.Mock).mockResolvedValue({
      error: true,
      message: ['limit must not be greater than 100'],
    });

    render(<ApiPlayground endpoint={searchEndpoint} />);
    typeSearch('run');
    await send();

    expect(screen.getByText('request_failed')).toBeInTheDocument();
    expect(screen.getByText('limit must not be greater than 100')).toBeInTheDocument();
  });

  it('строит пример запроса из текущих фильтров', () => {
    render(<ApiPlayground endpoint={searchEndpoint} />);
    typeSearch('run');

    expect(screen.getByText(/-d '{"search":"run","limit":10}'/)).toBeInTheDocument();
  });
});
