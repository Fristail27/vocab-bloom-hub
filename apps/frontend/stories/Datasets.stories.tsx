import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DatasetsSection } from '@/app/[locale]/(main-admin-content)/managing/datasets/_components/DatasetsSection';
import { EditedDatasetProvider } from '@/components/EditedDataset';
import { messagesFor } from '../.storybook/catalogs';
import { datasetList } from './mocks/fixtures';
import { readyButton, visibleDialog } from './interactions';

const meta = {
  title: 'Datasets/Management',
  component: DatasetsSection,
  args: { initial: datasetList() },
  decorators: [
    (Story, context) => (
      <EditedDatasetProvider initial={context.args.initial}>
        <Story />
      </EditedDatasetProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'The real datasets page. Create, fork, edit, open, activate and delete the in-memory fixtures. Replay to reset. No server, downloads or database are used.',
      },
    },
  },
} satisfies Meta<typeof DatasetsSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const CreateDataset: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const canvas = within(canvasElement);
    await canvas.findByTestId('dataset-study');
    await userEvent.click(canvas.getByTestId('own-dataset-create'));
    const dialog = await visibleDialog(canvasElement);
    await userEvent.type(dialog.getByTestId('own-dataset-name'), 'travel');
    await userEvent.type(dialog.getByTestId('own-dataset-title'), 'Travel vocabulary');
    await userEvent.type(dialog.getByTestId('own-dataset-attribution'), 'Example team');
    await userEvent.click(dialog.getByRole('button', { name: t.own_create }));
    const card = within(await canvas.findByTestId('dataset-travel'));
    await expect(card.getByText('Travel vocabulary', { exact: true })).toBeVisible();
    await expect(card.getByText(t.status_closed, { exact: true })).toBeVisible();
  },
};

export const InvalidAndReservedName: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    await within(canvasElement).findByTestId('dataset-study');
    await userEvent.click(within(canvasElement).getByTestId('own-dataset-create'));
    const dialog = await visibleDialog(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: t.own_create }));
    await expect((await dialog.findAllByText(t.own_required)).length).toBeGreaterThan(0);
    await userEvent.type(dialog.getByTestId('own-dataset-name'), 'opengloss');
    await userEvent.tab();
    await waitFor(() => expect(dialog.getByText(t.own_name_reserved)).toBeVisible());
  },
};

export const EditTermsAndVersion: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('dataset-edit-study'));
    const dialog = await visibleDialog(canvasElement);
    await userEvent.clear(dialog.getByTestId('own-dataset-title'));
    await userEvent.type(dialog.getByTestId('own-dataset-title'), 'Revised study dictionary');
    await userEvent.clear(dialog.getByTestId('own-dataset-version'));
    await userEvent.type(dialog.getByTestId('own-dataset-version'), '2.0');
    await userEvent.click(dialog.getByRole('button', { name: t.own_save }));
    await waitFor(() =>
      expect(within(canvas.getByTestId('dataset-study')).getByText('Revised study dictionary')).toBeVisible(),
    );
    await expect(within(canvas.getByTestId('dataset-study')).getByText('2.0')).toBeVisible();
  },
};

export const LicenseChangeConfirmation: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await within(canvasElement).findByTestId('dataset-edit-study'));
    const dialog = await visibleDialog(canvasElement);
    await userEvent.click(dialog.getByTestId('own-dataset-license'));
    await userEvent.click(
      await body.findByText('Creative Commons Zero v1.0 Universal (CC0-1.0)', { exact: true }),
    );
    await waitFor(() => expect(dialog.getByTestId('own-dataset-license-warning')).toBeVisible());
    await expect(dialog.getByRole('button', { name: t.own_save })).toBeDisabled();
    await userEvent.click(dialog.getByTestId('own-dataset-license-confirm'));
    await expect(dialog.getByRole('button', { name: t.own_save })).toBeEnabled();
  },
};

export const OpenAndActivate: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const card = within(await canvas.findByTestId('dataset-study'));
    await expect(card.queryByRole('button', { name: t.activate })).not.toBeInTheDocument();
    await userEvent.click(card.getByTestId('dataset-visibility-study'));
    const visibilityConfirmation = await body.findByRole('tooltip');
    await userEvent.click(await readyButton(within(visibilityConfirmation), t.visibility_open));
    await waitFor(() => expect(visibilityConfirmation).not.toBeVisible());
    await userEvent.click(await readyButton(card, t.activate));
    await userEvent.click(await readyButton(within(await body.findByRole('tooltip')), t.activate));
    await waitFor(() => expect(card.getByText(t.status_active, { exact: true })).toBeVisible());
    await expect(card.getByTestId('dataset-visibility-study')).toBeDisabled();
    await expect(card.queryByRole('button', { name: t.delete })).not.toBeInTheDocument();
  },
};

export const DeleteWithConfirmation: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const card = within(await canvas.findByTestId('dataset-study'));
    await userEvent.click(card.getByRole('button', { name: t.delete }));
    await expect(canvas.getByTestId('dataset-study')).toBeVisible();
    await userEvent.click(within(await body.findByRole('tooltip')).getByRole('button', { name: t.cancel }));
    await expect(canvas.getByTestId('dataset-study')).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: t.delete }));
    await userEvent.click(within(await body.findByRole('tooltip')).getByRole('button', { name: t.delete }));
    await waitFor(() => expect(canvas.queryByTestId('dataset-study')).not.toBeInTheDocument());
  },
};

export const DeleteFailure: Story = {
  parameters: { datasetScenario: { deleteError: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(await canvas.findByTestId('dataset-study')).getByRole('button', { name: t.delete }),
    );
    await userEvent.click(within(await body.findByRole('tooltip')).getByRole('button', { name: t.delete }));
    await waitFor(() => expect(body.getByText(messagesFor(globals).errors.unknown_error)).toBeVisible());
    await expect(canvas.getByTestId('dataset-study')).toBeVisible();
  },
};

export const CreateFork: Story = {
  play: async ({ canvasElement, globals }) => {
    const m = messagesFor(globals);
    const canvas = within(canvasElement);
    await userEvent.click(
      within(await canvas.findByTestId('dataset-opengloss')).getByRole('button', {
        name: m.provenance.fork_button,
      }),
    );
    const dialog = await visibleDialog(canvasElement);
    await userEvent.type(dialog.getByTestId('own-dataset-name'), 'my_fork');
    await userEvent.click(dialog.getByRole('button', { name: m.datasets.own_create }));
    await waitFor(() => expect(canvas.getByText(m.provenance.fork_progress)).toBeVisible());
    const card = within(await canvas.findByTestId('dataset-my_fork', {}, { timeout: 10000 }));
    await expect(card.getByText(m.datasets.status_closed, { exact: true })).toBeVisible();
  },
};

export const SourceUpdateToReview: Story = {
  parameters: { datasetScenario: { kind: 'source', source: 'wordnet' } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    await userEvent.click(
      within(await within(canvasElement).findByTestId('dataset-wordnet')).getByRole('button', {
        name: t.update,
      }),
    );
    const dialog = await visibleDialog(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: t.start_update }));
    await userEvent.click(
      await dialog.findByRole('button', { name: messagesFor(globals).reconciliation.review }),
    );
    const review = await visibleDialog(canvasElement, `${messagesFor(globals).reconciliation.title} · wordnet`);
    await waitFor(() => expect(review.getByText('lamp', { exact: true })).toBeVisible());
  },
};

export const InstallNewSource: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    const card = within(await within(canvasElement).findByTestId('dataset-wiktionary'));
    await userEvent.click(card.getByRole('button', { name: t.how_to_install }));
    const dialog = await visibleDialog(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: t.start }));
    await expect(
      await card.findByText(t.status_installed, { exact: true }, { timeout: 5000 }),
    ).toBeInTheDocument();
  },
};

export const SourceDownloadFailure: Story = {
  parameters: { datasetScenario: { installError: true } },
  play: async ({ canvasElement, globals }) => {
    const t = messagesFor(globals).datasets;
    await userEvent.click(
      within(await within(canvasElement).findByTestId('dataset-wordnet')).getByRole('button', {
        name: t.update,
      }),
    );
    const dialog = await visibleDialog(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: t.start_update }));
    await waitFor(() => expect(dialog.getByTestId('install-error')).toBeVisible());
    // Ant's exiting spinner can remain in the accessible name during its animation.
    await waitFor(() => expect(dialog.getByText(t.retry).closest('button')).toBeEnabled());
  },
};

export const SQLiteRestrictions: Story = {
  args: { initial: datasetList(false) },
  parameters: { datasetScenario: { unsupported: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('datasets-unsupported')).toBeVisible());
    await expect(canvas.getByTestId('own-dataset-create')).toBeDisabled();
  },
};

export const LoadFailure: Story = {
  args: { initial: undefined },
  parameters: { datasetScenario: { listError: true } },
};
export const LoadFromApi: Story = {
  args: { initial: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('dataset-study')).toBeVisible());
    await expect(canvas.getByTestId('own-dataset-create')).toBeEnabled();
  },
};
export const Russian: Story = { globals: { locale: 'ru' } };
export const ArabicRTL: Story = { globals: { locale: 'ar' } };
