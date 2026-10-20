import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import type { EnWordT } from 'server/types';
import { ReviewScopeE as Scope, ReviewStatusE as Status } from 'server/types/reviews';
import { reviewContent } from 'server/core/utils/content_review';
import { ContentReview, ContentReviewProvider } from '../index';
import { ReviewBrowser } from '../ReviewBrowser';
import { EnApi } from '@/core/api/EnApi';

jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));
jest.mock('@/components/EditedDataset', () => ({ useEditedDataset: () => ({ edited: { name: 'mine' } }) }));
jest.mock('@/core/api/EnApi', () => ({
  EnApi: { wordReviews: jest.fn(), setContentReview: jest.fn(), reviewWords: jest.fn() },
}));
const word = {
  id: 1,
  word: 'bird',
  part_of_speech: 'noun',
  meanings: [{ id: 2, title: 'bird', definition: 'feathered animal', translations: [] }],
  short_translations: [],
} as unknown as EnWordT;
const expected = reviewContent(Scope.definition, word, word.meanings[0]);
const review = { id: 2, scope: Scope.definition, status: Status.unchecked, checked_at: null, expected };
const show = (value = word) => (
  <App>
    <ContentReviewProvider word={value} enabled dataset="mine">
      <ContentReview scope={Scope.definition} id={2} />
    </ContentReviewProvider>
  </App>
);
beforeEach(() => {
  jest.clearAllMocks();
  (EnApi.wordReviews as jest.Mock).mockResolvedValue([review]);
  (EnApi.setContentReview as jest.Mock).mockResolvedValue({ ...review, status: Status.checked });
});

it('loads once, marks exactly the displayed content in its dataset, and clears the mark', async () => {
  render(show());
  fireEvent.click(await screen.findByRole('button', { name: 'check' }));
  expect(EnApi.setContentReview).toHaveBeenCalledWith(Scope.definition, 2, { checked: true, expected }, 'mine');
  expect(await screen.findByText('checked')).toBeInTheDocument();
  (EnApi.setContentReview as jest.Mock).mockResolvedValue(review);
  fireEvent.click(screen.getByRole('button', { name: 'clear' }));
  expect(await screen.findByRole('button', { name: 'check' })).toBeEnabled();
  expect(EnApi.wordReviews).toHaveBeenCalledTimes(1);
});

it('does not offer confirmation when the server has a newer text than the card', async () => {
  (EnApi.wordReviews as jest.Mock).mockResolvedValue([{ ...review, expected: 'newer content' }]);
  render(show());
  expect(await screen.findByText('stale')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'check' })).toBeDisabled();
  expect(EnApi.setContentReview).not.toHaveBeenCalled();
});

it('reloads after a content edit and offers reconfirmation for the changed portion', async () => {
  const view = render(show());
  await screen.findByRole('button', { name: 'check' });
  const changed = { ...word, meanings: [{ ...word.meanings[0], definition: 'changed definition' }] };
  (EnApi.wordReviews as jest.Mock).mockResolvedValue([
    {
      ...review,
      status: Status.changed,
      expected: reviewContent(Scope.definition, changed, changed.meanings[0]),
    },
  ]);
  view.rerender(show(changed));
  expect(await screen.findByRole('button', { name: 'recheck' })).toBeEnabled();
  expect(EnApi.wordReviews).toHaveBeenCalledTimes(2);
});

it('shows a failed read and allows retry without inventing an unchecked status', async () => {
  (EnApi.wordReviews as jest.Mock).mockResolvedValueOnce({ error: true, message: 'failed_fetch' });
  render(show());
  expect(await screen.findByText('load_error')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'check' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'retry' }));
  expect(await screen.findByRole('button', { name: 'check' })).toBeEnabled();
});

it('does not load or expose review controls on a preview card', async () => {
  render(
    <ContentReviewProvider word={word} enabled={false}>
      <ContentReview scope={Scope.definition} id={2} />
    </ContentReviewProvider>,
  );
  expect(EnApi.wordReviews).not.toHaveBeenCalled();
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
});

it('loads filtered word counts on demand and retains the dataset in editor links', async () => {
  (EnApi.reviewWords as jest.Mock).mockResolvedValue({
    items: [{ id: 1, word: 'bird', part_of_speech: 'noun', matches: 2 }],
    total: 1,
    page: 1,
    limit: 20,
    counts: { checked: 0, unchecked: 2, changed: 0 },
  });
  const { container } = render(<ReviewBrowser search="bi" />);
  expect(EnApi.reviewWords).not.toHaveBeenCalled();
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect(await screen.findByRole('link', { name: 'bird (noun)' })).toHaveAttribute(
    'href',
    '/en/managing/edit-word/1?dataset=mine',
  );
  expect(EnApi.reviewWords).toHaveBeenCalledWith(
    { scope: Scope.definition, status: Status.unchecked, search: 'bi', page: 1, limit: 20 },
    'mine',
  );
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'status' }));
  const list = await screen.findByRole('listbox');
  fireEvent.click(within(list).getByRole('option', { name: 'changed' }));
  await waitFor(() =>
    expect(EnApi.reviewWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: Status.changed, page: 1 }),
      'mine',
    ),
  );
});
