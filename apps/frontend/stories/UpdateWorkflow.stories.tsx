import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Reconciliation } from '@/components/Reconciliation';
import { messagesFor } from '../.storybook/catalogs';
import { readyButton, visibleDialog } from './interactions';

const meta = {
  title: 'Datasets/Preparing and applying updates',
  component: Reconciliation,
  args: { dataset: 'study' },
} satisfies Meta<typeof Reconciliation>;
export default meta;
type Story = StoryObj<typeof meta>;

async function open(canvasElement: HTMLElement, globals: Record<string, unknown>) {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: messagesFor(globals).reconciliation.title }),
  );
  return visibleDialog(canvasElement);
}

export const UpdateForkFromParent: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await open(canvasElement, globals);
    const parent = await dialog.findByRole('button', { name: t.parent.replace('{name}', 'opengloss') });
    await waitFor(() => expect(parent).toBeEnabled());
    await userEvent.click(parent);
    await waitFor(() =>
      expect(dialog.getByText(t.preparation_running.replace('{source}', 'opengloss'))).toBeVisible(),
    );
    await waitFor(() => expect(dialog.getByText('lamp', { exact: true })).toBeVisible(), { timeout: 10000 });
  },
};

export const MergeAnotherDataset: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await open(canvasElement, globals);
    const selector = await dialog.findByRole('combobox', { name: t.merge_source });
    await waitFor(() => expect(selector).toBeEnabled());
    await userEvent.click(selector);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByText('Open English WordNet', { exact: true }),
    );
    await userEvent.click(dialog.getByRole('button', { name: t.prepare }));
    await waitFor(() => expect(dialog.getByText('lamp', { exact: true })).toBeVisible(), { timeout: 10000 });
  },
};

export const ManualReviewWithoutBaseline: Story = {
  parameters: { datasetScenario: { baselineMissing: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await open(canvasElement, globals);
    const selector = await dialog.findByRole('combobox', { name: t.merge_source });
    await waitFor(() => expect(selector).toBeEnabled());
    await userEvent.click(selector);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByText('Open English WordNet', { exact: true }),
    );
    await userEvent.click(dialog.getByRole('button', { name: t.prepare }));
    await waitFor(() => expect(dialog.getByText(t.baseline_required)).toBeVisible());
    await waitFor(() => expect(dialog.getByRole('switch', { name: t.two_way })).toBeEnabled());
    await userEvent.click(dialog.getByRole('switch', { name: t.two_way }));
    await userEvent.click(await readyButton(dialog, t.prepare));
    await waitFor(() => expect(dialog.getByText(t.legacy_review)).toBeVisible(), { timeout: 10000 });
  },
};

export const PreparationInProgress: Story = {
  parameters: { datasetScenario: { preparation: 'running' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await open(canvasElement, globals);
    await waitFor(() => expect(dialog.getByRole('progressbar', { name: t.stage_comparing })).toBeVisible());
  },
};

export const ApplicationInProgress: Story = {
  parameters: { datasetScenario: { application: 'running' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await open(canvasElement, globals);
    await waitFor(() => expect(dialog.getByText(t.application_running)).toBeVisible());
    await expect(dialog.getByRole('progressbar', { name: t.application_stage_history })).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Close' }));
    const reopened = await open(canvasElement, globals);
    await waitFor(() => expect(reopened.getByText(t.application_running)).toBeVisible());
  },
};

export const PreparationFailure: Story = {
  parameters: { datasetScenario: { preparation: 'failed' } },
  play: async ({ canvasElement, globals }) => {
    const dialog = await open(canvasElement, globals);
    await waitFor(() =>
      expect(dialog.getByText(messagesFor(globals).reconciliation.baseline_required)).toBeVisible(),
    );
  },
};

export const ApplicationFailure: Story = {
  parameters: { datasetScenario: { application: 'failed' } },
  play: async ({ canvasElement, globals }) => {
    const dialog = await open(canvasElement, globals);
    await waitFor(() => expect(dialog.getByText(messagesFor(globals).reconciliation.stale)).toBeVisible());
  },
};
