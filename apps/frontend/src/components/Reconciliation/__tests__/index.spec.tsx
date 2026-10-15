import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReconciliationItemT, ReconciliationSummaryT } from 'server/types/reconciliation';

jest.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
      { has: () => false },
    ),
  useLocale: () => 'en',
}));
jest.mock('@/core/api/ReconciliationApi', () => ({
  ReconciliationApi: {
    list: jest.fn(),
    summary: jest.fn(),
    items: jest.fn(),
    decide: jest.fn(),
    override: jest.fn(),
    apply: jest.fn(),
    cancel: jest.fn(),
    prepare: jest.fn(),
  },
}));
import { ReconciliationApi } from '@/core/api/ReconciliationApi';
import { Reconciliation } from '../index';

const item = (): ReconciliationItemT => ({
  plan: 'plan',
  headword: 'lamp',
  category: 'conflicts',
  version: 0,
  decisions: [],
  remaining: 1,
  result: { present: true, value: { description: 'local description' } },
  comparison: {
    category: 'conflicts',
    result: { present: true, value: { description: 'local description' } },
    conflicts: [
      {
        path: ['description'],
        kind: 'edit',
        baseline: { present: true, value: 'original description' },
        local: { present: true, value: 'local description' },
        incoming: { present: true, value: 'incoming description' },
      },
    ],
  },
});
const summary = (): ReconciliationSummaryT => ({
  id: 'plan',
  kind: 'source',
  status: 'review',
  source: 'parent',
  incoming_revision: 'revision',
  created_at: '2026-10-01T00:00:00Z',
  counts: { added: 1, deleted: 2, changed: 3, conflicts: 1, unchanged: 0, local_only: 0 },
  resolved_articles: 0,
  remaining_conflicts: 1,
  proposed: { added: 1, deleted: 2, changed: 3 },
});

describe('persistent update review', () => {
  const computedStyle = window.getComputedStyle;
  beforeAll(() => {
    window.getComputedStyle = (element) => computedStyle(element);
  });
  afterAll(() => {
    window.getComputedStyle = computedStyle;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (ReconciliationApi.list as jest.Mock).mockResolvedValue({
      plans: [{ id: 'plan', status: 'review', created_at: '2026-10-01T00:00:00Z' }],
      parents: [],
    });
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue(summary());
    (ReconciliationApi.items as jest.Mock).mockResolvedValue({ items: [item()], total: 1 });
  });

  it('shows three versions, blocks apply before saving, and persists an explicit keep-local decision', async () => {
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp · conflicts (1)'));
    expect(screen.getByText('original description')).toBeInTheDocument();
    expect(screen.getByText('local description')).toBeInTheDocument();
    expect(screen.getByText('incoming description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'apply' })).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'keep' })[0]);
    expect(await screen.findAllByText('unsaved')).not.toHaveLength(0);
    expect(ReconciliationApi.decide).not.toHaveBeenCalled();
    (ReconciliationApi.decide as jest.Mock).mockResolvedValue({ ...item(), version: 1, remaining: 0 });
    (ReconciliationApi.items as jest.Mock).mockResolvedValue({
      items: [{ ...item(), version: 1, remaining: 0, decisions: [{ path: ['description'], choice: 'local' }] }],
      total: 1,
    });
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue({
      ...summary(),
      remaining_conflicts: 0,
      resolved_articles: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(ReconciliationApi.decide).toHaveBeenCalledWith('fork', 'plan', 'lamp', 0, [
        { path: ['description'], choice: 'local' },
      ]),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'apply' })).toBeEnabled());
    expect(ReconciliationApi.apply).not.toHaveBeenCalled();
    (ReconciliationApi.apply as jest.Mock).mockResolvedValue({ ...summary(), status: 'applied' });
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    await waitFor(() => expect(ReconciliationApi.apply).toHaveBeenCalledWith('fork', 'plan'));
  });

  it('can discard an unsaved decision and inspect an applied operation without editing it', async () => {
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp · conflicts (1)'));
    fireEvent.click(screen.getAllByRole('button', { name: 'accept' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'discard' }));
    await waitFor(() => expect(screen.queryByText('unsaved')).not.toBeInTheDocument());
    expect(ReconciliationApi.decide).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue({ ...summary(), status: 'applied' });
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'apply' })).not.toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'keep' })).not.toBeInTheDocument();
  });
});
