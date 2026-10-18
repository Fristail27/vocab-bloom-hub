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
    preparation: jest.fn(),
    application: jest.fn(),
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
    (ReconciliationApi.preparation as jest.Mock).mockResolvedValue({ preparation: null });
    (ReconciliationApi.application as jest.Mock).mockResolvedValue({ application: null });
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
    fireEvent.click(await screen.findByText('lamp'));
    expect(screen.getByText('original description')).toBeInTheDocument();
    expect(screen.getByText('local description')).toBeInTheDocument();
    expect(screen.getByText('incoming description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'apply' })).toBeDisabled();
    await waitFor(() => expect(screen.getByText('needs_decision')).toBeVisible());
    expect(screen.getByText('choose_result')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'keep' }));
    expect(screen.getByRole('button', { name: 'keep' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'accept' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByRole('region', { name: 'result' })).getByText('local description')).toBeVisible();
    expect(screen.getAllByText('decision_pending').length).toBeGreaterThan(0);
    expect(screen.queryByText('decision_saved')).not.toBeInTheDocument();
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
    expect(screen.getAllByText('decision_saved').length).toBeGreaterThan(0);
    expect(screen.queryByText('decision_pending')).not.toBeInTheDocument();
    expect(ReconciliationApi.apply).not.toHaveBeenCalled();
    (ReconciliationApi.apply as jest.Mock).mockResolvedValue({
      id: 'apply-job',
      plan_id: 'plan',
      state: 'running',
      stage: 'waiting',
      processed: 0,
      started_at: new Date().toISOString(),
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'apply' })).not.toHaveClass('ant-btn-loading'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    await waitFor(() => expect(ReconciliationApi.apply).toHaveBeenCalledWith('fork', 'plan'));
  });

  it('can discard an unsaved decision and inspect an applied operation without editing it', async () => {
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp'));
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

  it('hides acquisition bookkeeping in the editor but preserves it when saving an edited article', async () => {
    const origins = [
      {
        id: 'private-origin-id',
        name: 'Example source',
        version: '2.4',
        recorded_at: '2026-10-04T18:59:56.630Z',
        method: 'dataset',
        inherited: true,
        licenses: [{ name: 'CC0', url: 'https://example.org/license' }],
        acquisitions: [
          {
            id: '58b727a8-296a-4278-87be-345e4a8a7dc6',
            method: 'fork',
            recorded_at: '2026-10-04T18:59:56.630Z',
            revision: '19756:19756:',
          },
        ],
      },
    ];
    const article = {
      ...item(),
      result: {
        present: true as const,
        value: { parts: { noun: { common: { description: 'local description', origins } } } },
      },
    };
    (ReconciliationApi.items as jest.Mock).mockResolvedValue({ items: [article], total: 1 });
    (ReconciliationApi.override as jest.Mock).mockResolvedValue(article);
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp'));
    fireEvent.click(screen.getByText('whole_article'));
    fireEvent.click(screen.getByRole('button', { name: 'edit_article' }));
    expect(await screen.findByText('Example source')).toBeInTheDocument();
    expect(screen.getByText('CC0')).toBeInTheDocument();
    for (const text of [
      'private-origin-id',
      '58b727a8-296a-4278-87be-345e4a8a7dc6',
      '19756:19756:',
      '2026-10-04T18:59:56.630Z',
      'recorded at',
      'method',
      'acquisitions',
    ])
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'result' }), {
      target: { value: 'custom description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(ReconciliationApi.override).toHaveBeenCalledWith('fork', 'plan', 'lamp', 0, {
        present: true,
        value: { parts: { noun: { common: { description: 'custom description', origins } } } },
      }),
    );
  });

  it('makes an incoming deletion explicit and saves that choice without changing its meaning', async () => {
    const deleted = item();
    deleted.comparison.conflicts[0].incoming = { present: false };
    deleted.comparison.conflicts[0].kind = 'delete';
    (ReconciliationApi.items as jest.Mock).mockResolvedValue({ items: [deleted], total: 1 });
    (ReconciliationApi.decide as jest.Mock).mockResolvedValue(deleted);
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp'));
    await waitFor(() => expect(screen.getByText('deleted_value')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    expect(within(screen.getByRole('region', { name: 'result' })).getByText('result_deleted')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(ReconciliationApi.decide).toHaveBeenCalledWith('fork', 'plan', 'lamp', 0, [
        { path: ['description'], choice: 'incoming' },
      ]),
    );
    expect(ReconciliationApi.override).not.toHaveBeenCalled();
  });

  it('starts a custom result from the chosen version and restores field decisions after leaving whole-article editing', async () => {
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    fireEvent.click(await screen.findByText('lamp'));
    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    const input = screen.getByRole('textbox', { name: 'result' });
    expect(input).toHaveValue('incoming description');
    fireEvent.change(input, { target: { value: 'combined description' } });
    expect(screen.getByRole('button', { name: 'accept' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByText('whole_article'));
    fireEvent.click(screen.getByRole('button', { name: 'edit_article' }));
    expect(screen.queryByRole('button', { name: 'accept' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('whole_article_hint')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'back_to_fields' }));
    expect(screen.getByRole('textbox', { name: 'result' })).toHaveValue('combined description');
    (ReconciliationApi.decide as jest.Mock).mockResolvedValue(item());
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(ReconciliationApi.decide).toHaveBeenCalledWith('fork', 'plan', 'lamp', 0, [
        { path: ['description'], choice: 'custom', result: { present: true, value: 'combined description' } },
      ]),
    );
    expect(ReconciliationApi.override).not.toHaveBeenCalled();
  });

  const running = () => ({
    id: 'job',
    source: 'parent',
    state: 'running',
    stage: 'comparing',
    processed: 12,
    total: 40,
    started_at: new Date().toISOString(),
  });

  const applying = () => ({
    id: 'apply-job',
    plan_id: 'plan',
    state: 'running',
    stage: 'publishing',
    processed: 2,
    total: 5,
    started_at: new Date().toISOString(),
  });

  it('starts apply once, resumes after reopening and refreshes only when publication completes', async () => {
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue({ ...summary(), remaining_conflicts: 0 });
    (ReconciliationApi.apply as jest.Mock).mockResolvedValue(applying());
    const onApplied = jest.fn();
    const view = render(<Reconciliation dataset="fork" initialPlan="plan" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    const apply = await screen.findByRole('button', { name: 'apply' });
    (ReconciliationApi.application as jest.Mock).mockResolvedValue({ application: applying() });
    fireEvent.click(apply);
    await waitFor(() => expect(screen.getByText('application_stage_publishing')).toBeVisible());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.queryByRole('button', { name: 'apply' })).not.toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
    view.unmount();
    (ReconciliationApi.list as jest.Mock).mockClear();
    (ReconciliationApi.summary as jest.Mock).mockClear();
    (ReconciliationApi.preparation as jest.Mock).mockResolvedValue({
      preparation: {
        ...running(),
        state: 'completed',
        plan_id: 'older-plan',
        started_at: '2000-01-01T00:00:00Z',
      },
    });
    render(<Reconciliation dataset="fork" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    await waitFor(() => expect(screen.getByText('application_stage_publishing')).toBeVisible());
    expect(ReconciliationApi.list).not.toHaveBeenCalled();
    expect(ReconciliationApi.summary).not.toHaveBeenCalled();
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue({
      ...summary(),
      status: 'applied',
      remaining_conflicts: 0,
    });
    (ReconciliationApi.application as jest.Mock).mockResolvedValue({
      application: { ...applying(), state: 'completed' },
    });
    expect(
      await screen.findByText('actual {"added":1,"deleted":2,"changed":3}', {}, { timeout: 3000 }),
    ).toBeVisible();
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(ReconciliationApi.summary).toHaveBeenLastCalledWith('fork', 'plan');
    expect(ReconciliationApi.apply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('recovers a lost apply acknowledgement, retries status reads, and shows a stale-plan failure', async () => {
    (ReconciliationApi.summary as jest.Mock).mockResolvedValue({ ...summary(), remaining_conflicts: 0 });
    (ReconciliationApi.apply as jest.Mock).mockResolvedValue({ error: true, message: 'failed_fetch' });
    const onApplied = jest.fn();
    render(<Reconciliation dataset="fork" initialPlan="plan" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    const apply = await screen.findByRole('button', { name: 'apply' });
    (ReconciliationApi.application as jest.Mock)
      .mockResolvedValueOnce({ error: true, message: 'failed_fetch' })
      .mockResolvedValue({ application: applying() });
    fireEvent.click(apply);
    expect(await screen.findByText('progress_unavailable')).toBeVisible();
    expect(await screen.findByText('application_stage_publishing', {}, { timeout: 4000 })).toBeVisible();
    (ReconciliationApi.application as jest.Mock).mockResolvedValue({
      application: { ...applying(), state: 'failed', failure: 'reconciliation_plan_stale' },
    });
    expect(await screen.findByText('stale', {}, { timeout: 3000 })).toBeVisible();
    expect(onApplied).not.toHaveBeenCalled();
    expect(ReconciliationApi.apply).toHaveBeenCalledTimes(1);
  });

  it('rechecks the saved plan after a restart without automatically applying it again', async () => {
    (ReconciliationApi.application as jest.Mock)
      .mockResolvedValueOnce({ application: applying() })
      .mockResolvedValue({ application: null });
    render(<Reconciliation dataset="fork" initialPlan="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    await waitFor(() => expect(screen.getByText('application_stage_publishing')).toBeVisible());
    expect(await screen.findByText('application_interrupted', {}, { timeout: 3000 })).toBeVisible();
    expect(ReconciliationApi.summary).toHaveBeenCalledWith('fork', 'plan');
    expect(ReconciliationApi.apply).not.toHaveBeenCalled();
  });

  it('starts background preparation, resumes its progress after reopening, and opens the completed review', async () => {
    (ReconciliationApi.list as jest.Mock).mockResolvedValue({
      plans: [],
      parents: [{ lineage: 'parent', source: 'parent', revision: 'base' }],
    });
    (ReconciliationApi.prepare as jest.Mock).mockResolvedValue(running());
    const view = render(<Reconciliation dataset="fork" />);
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    const prepare = await screen.findByRole('button', { name: 'parent {"name":"parent"}' });
    await waitFor(() => expect(prepare).toBeEnabled());
    (ReconciliationApi.preparation as jest.Mock).mockResolvedValue({ preparation: running() });
    fireEvent.click(prepare);
    await screen.findByText('processed_total {"count":12,"total":40}');
    await waitFor(() => expect(screen.getByText('processed_total {"count":12,"total":40}')).toBeVisible());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
    expect(prepare).toBeDisabled();
    expect(ReconciliationApi.prepare).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<Reconciliation dataset="fork" />);
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    expect(await screen.findByText('processed_total {"count":12,"total":40}')).toBeInTheDocument();
    (ReconciliationApi.preparation as jest.Mock).mockResolvedValue({
      preparation: { ...running(), state: 'completed', plan_id: 'plan' },
    });
    expect(await screen.findByText('lamp', {}, { timeout: 3000 })).toBeVisible();
    expect(screen.queryByRole('progressbar', { name: 'stage_comparing' })).not.toBeInTheDocument();
    expect(ReconciliationApi.prepare).toHaveBeenCalledTimes(1);
  });

  it('retries unavailable progress and shows preparation failure without applying anything', async () => {
    (ReconciliationApi.preparation as jest.Mock)
      .mockResolvedValueOnce({ error: true, message: 'failed_fetch' })
      .mockResolvedValue({
        preparation: { ...running(), state: 'failed', failure: 'reconciliation_baseline_required' },
      });
    render(<Reconciliation dataset="fork" />);
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    expect(await screen.findByText('progress_unavailable')).toBeInTheDocument();
    expect(await screen.findByText('baseline_required', {}, { timeout: 4000 })).toBeVisible();
    expect(screen.queryByText('progress_unavailable')).not.toBeInTheDocument();
    expect(ReconciliationApi.apply).not.toHaveBeenCalled();
  });

  it('reports an interrupted preparation instead of spinning forever after a server restart', async () => {
    (ReconciliationApi.preparation as jest.Mock)
      .mockResolvedValueOnce({ preparation: running() })
      .mockResolvedValue({ preparation: null });
    render(<Reconciliation dataset="fork" />);
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    expect(await screen.findByText('stage_comparing')).toBeInTheDocument();
    expect(await screen.findByText('preparation_interrupted', {}, { timeout: 3000 })).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
