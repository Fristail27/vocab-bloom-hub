import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Reconciliation } from '@/components/Reconciliation';
import { messagesFor } from '../.storybook/catalogs';
import { PLAN_ID } from './mocks/fixtures';
import { readyButton, visibleDialog } from './interactions';

const meta = {
  title: 'Datasets/Merge and conflict resolution',
  component: Reconciliation,
  args: { dataset: 'study', initialPlan: PLAN_ID, onApplied: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'The production review dialog with an in-memory API. Decisions persist until this story is replayed. These stories exercise the client workflow; the server merge algorithm is covered by its own suites.',
      },
    },
  },
} satisfies Meta<typeof Reconciliation>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openReview(canvasElement: HTMLElement, globals: Record<string, unknown>, word?: string) {
  const labels = messagesFor(globals).reconciliation;
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: labels.review }));
  const dialog = await visibleDialog(canvasElement);
  if (word) {
    await userEvent.click(await dialog.findByText(word, { exact: true }));
    await waitFor(() => expect(dialog.getByRole('button', { name: labels.accept })).toBeVisible());
  }
  return dialog;
}

export const UnresolvedDescription: Story = {
  play: async ({ canvasElement, globals }) => {
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await expect(
      dialog.getByRole('button', { name: messagesFor(globals).reconciliation.apply }),
    ).toBeDisabled();
  },
};

export const ChooseSaveAndApply: Story = {
  play: async ({ canvasElement, globals, args }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await userEvent.click(dialog.getByRole('button', { name: t.accept }));
    await expect(dialog.getByRole('button', { name: t.apply })).toBeDisabled();
    await expect(
      within(dialog.getByRole('region', { name: t.result })).getByText(
        'An electric device used to illuminate a room.',
      ),
    ).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await userEvent.click(await readyButton(dialog, t.apply));
    await waitFor(() => expect(dialog.getByText(t.application_running)).toBeVisible());
    await waitFor(() => expect(args.onApplied).toHaveBeenCalledOnce(), { timeout: 10000 });
    await expect(dialog.queryByRole('button', { name: t.apply })).not.toBeInTheDocument();
  },
};

export const KeepOurs: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await userEvent.click(dialog.getByRole('button', { name: t.keep }));
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
    await expect(
      within(dialog.getByRole('region', { name: t.result })).getByText('A portable light for reading.'),
    ).toBeVisible();
  },
};

export const CustomResult: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await userEvent.click(dialog.getByRole('button', { name: t.accept }));
    await userEvent.click(dialog.getByRole('button', { name: t.edit }));
    const input = dialog.getByRole('textbox', { name: t.result });
    await expect(input).toHaveValue('An electric device used to illuminate a room.');
    await userEvent.clear(input);
    await userEvent.type(input, 'A portable electric light for reading.');
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
    await expect(dialog.getByRole('textbox', { name: t.result })).toHaveValue(
      'A portable electric light for reading.',
    );
  },
};

export const DiscardUnsavedDecision: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await userEvent.click(dialog.getByRole('button', { name: t.accept }));
    await userEvent.click(dialog.getByRole('button', { name: t.discard }));
    await expect(dialog.getByRole('button', { name: t.apply })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: t.save })).toBeDisabled();
    await expect(dialog.getByText(t.choose_result)).toBeVisible();
  },
};

export const MultipleFields: Story = {
  parameters: { datasetScenario: { conflict: 'translation' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await userEvent.click(await dialog.findByText('lamp', { exact: true }));
    const choices = await dialog.findAllByRole('button', { name: t.accept });
    await userEvent.click(choices[0]);
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('status')).toHaveTextContent(t.save_hint));
    await expect(dialog.getByRole('button', { name: t.apply })).toBeDisabled();
    await userEvent.click(dialog.getAllByRole('button', { name: t.keep })[1]);
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
  },
};

export const DeletedUpstream: Story = {
  parameters: { datasetScenario: { conflict: 'deletion' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'obsolete-lamp');
    await expect(dialog.getByText(t.deleted_value)).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: t.accept }));
    await expect(dialog.getByText(t.result_deleted)).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
  },
};

export const ReplaceWholeArticle: Story = {
  parameters: { datasetScenario: { conflict: 'translation' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await userEvent.click(await dialog.findByText('lamp', { exact: true }));
    await userEvent.click(dialog.getByText(t.whole_article, { selector: 'summary' }));
    await userEvent.click(dialog.getByRole('button', { name: t.accept_article }));
    await waitFor(() => expect(dialog.getByRole('region', { name: t.whole_article })).toBeVisible());
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
  },
};

export const SaveFailureAndRetry: Story = {
  parameters: { datasetScenario: { saveError: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals, 'lamp');
    await userEvent.click(dialog.getByRole('button', { name: t.keep }));
    await userEvent.click(dialog.getByRole('button', { name: t.save }));
    await waitFor(() => expect(dialog.getByText(t.error)).toBeVisible());
    await expect(dialog.getByRole('button', { name: t.apply })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: t.keep })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(await readyButton(dialog, t.save));
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
  },
};

export const StalePlan: Story = {
  parameters: { datasetScenario: { noConflicts: true, stale: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await userEvent.click(await readyButton(dialog, t.apply));
    await waitFor(() => expect(dialog.getByText(t.stale)).toBeVisible());
  },
};

export const CancelPlan: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await userEvent.click(await dialog.findByRole('button', { name: t.cancel }));
    await waitFor(() => expect(dialog.getByText(t.cancelled, { exact: true })).toBeVisible());
    await expect(dialog.queryByRole('button', { name: t.apply })).not.toBeInTheDocument();
  },
};

export const AddedChangedAndDeleted: Story = {
  parameters: { datasetScenario: { noConflicts: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await userEvent.click(await dialog.findByRole('button', { name: t.all }));
    await waitFor(() => expect(dialog.getByText('lantern', { exact: true })).toBeVisible());
    await expect(dialog.getByText('old-word', { exact: true })).toBeVisible();
    await expect(dialog.getByText('light', { exact: true })).toBeVisible();
    await waitFor(() => expect(dialog.getByRole('button', { name: t.apply })).toBeEnabled());
  },
};

export const PaginationAndSearch: Story = {
  parameters: { datasetScenario: { many: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await dialog.findByText('lamp', { exact: true });
    await waitFor(() => expect(dialog.getByRole('button', { name: t.cancel })).toBeEnabled());
    await userEvent.click(dialog.getByTitle('2'));
    await waitFor(() => expect(dialog.getByText('sample-30', { exact: true })).toBeVisible());
    await expect(dialog.queryByText('lamp', { exact: true })).not.toBeInTheDocument();
    const input = dialog.getByRole('searchbox', { name: t.search });
    await userEvent.type(input, 'lamp{Enter}');
    await waitFor(() => expect(dialog.getByText('lamp', { exact: true })).toBeVisible());
    await waitFor(() => expect(dialog.queryByText('sample-30', { exact: true })).not.toBeInTheDocument());
  },
};

export const NoCommonBaseline: Story = {
  parameters: { datasetScenario: { baselineMissing: true } },
  play: UnresolvedDescription.play,
};
export const PartialSource: Story = {
  parameters: { datasetScenario: { partial: true } },
  play: UnresolvedDescription.play,
};
export const LinkedWordConflict: Story = {
  parameters: { datasetScenario: { conflict: 'dependency' } },
  play: UnresolvedDescription.play,
};
export const LongMultilingualText: Story = {
  parameters: { datasetScenario: { conflict: 'long' } },
  play: UnresolvedDescription.play,
};
export const ArabicRTL: Story = { globals: { locale: 'ar' }, play: UnresolvedDescription.play };
export const DarkTheme: Story = { globals: { theme: 'dark' }, play: UnresolvedDescription.play };
export const AppliedReadOnly: Story = {
  parameters: { datasetScenario: { status: 'applied', noConflicts: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).reconciliation;
    const dialog = await openReview(canvasElement, globals);
    await waitFor(() => expect(dialog.getByText(t.applied, { exact: true })).toBeVisible());
    await expect(dialog.queryByRole('button', { name: t.apply })).not.toBeInTheDocument();
  },
};
