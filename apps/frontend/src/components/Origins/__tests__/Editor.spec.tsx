import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OriginT } from 'server/types';
import { OriginsEditor } from '../Editor';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
// rc-util gives every modal the same title id in test mode. Use real React ids for nested dialogs.
jest.mock('@rc-component/util/lib/hooks/useId', () => ({
  ...jest.requireActual('@rc-component/util/lib/hooks/useId'),
  __esModule: true,
  default: (id?: string) => {
    const generated = jest.requireActual('react').useId();
    return id ?? generated;
  },
}));

const origin: OriginT = {
  id: 'manual',
  name: 'Original source',
  version: '1',
  url: 'https://example.org/glossary',
  record_url: 'https://example.org/glossary/word',
  attribution: 'Contributors',
  notices: [],
  method: 'manual',
  inherited: false,
  recorded_at: null,
  scope: 'word',
  license_relation: 'all',
  licenses: [
    {
      spdx: 'CC-BY-4.0',
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
      text: 'Verbatim supplied license text.',
    },
  ],
};

it('preserves supplied license text when correcting a manual source using a standard license', async () => {
  const onChange = jest.fn();
  render(<OriginsEditor context="word" value={[origin]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'edit_source' }));
  const dialog = within(screen.getByRole('dialog', { name: 'edit_source' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'source_name' }), {
    target: { value: 'Corrected source' },
  });
  fireEvent.click(dialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls[0][0][0]).toMatchObject({
    name: 'Corrected source',
    licenses: [{ text: origin.licenses[0].text }],
  });
});

it('edits license details independently of the source metadata', async () => {
  const custom = {
    spdx: 'LicenseRef-Glossary',
    name: 'Glossary terms',
    url: 'https://example.org/license',
    text: 'Original terms',
  };
  const source = { ...origin, licenses: [...origin.licenses, custom] };
  const onChange = jest.fn();
  render(<OriginsEditor context="word" value={[source]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'edit_source' }));
  const sourceDialog = within(screen.getByRole('dialog', { name: 'edit_source' }));
  fireEvent.click(sourceDialog.getAllByRole('button', { name: 'edit_license' })[1]);
  const licenseDialog = within(screen.getByRole('dialog', { name: 'edit_license' }));
  expect(licenseDialog.queryByRole('textbox', { name: 'version' })).not.toBeInTheDocument();
  expect(licenseDialog.queryByRole('textbox', { name: 'source_link' })).not.toBeInTheDocument();
  expect(licenseDialog.queryByRole('textbox', { name: 'record_link' })).not.toBeInTheDocument();
  fireEvent.change(licenseDialog.getByRole('textbox', { name: 'license_name' }), {
    target: { value: 'Corrected license' },
  });
  fireEvent.change(licenseDialog.getByRole('textbox', { name: 'license_link' }), {
    target: { value: 'https://example.org/terms' },
  });
  fireEvent.change(licenseDialog.getByRole('textbox', { name: 'license_text' }), {
    target: { value: 'Corrected terms' },
  });
  fireEvent.click(licenseDialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'edit_license' })).not.toBeInTheDocument());
  expect(onChange).not.toHaveBeenCalled();
  expect(sourceDialog.getByRole('textbox', { name: 'source_link' })).toHaveValue(origin.url);
  fireEvent.click(sourceDialog.getByRole('button', { name: 'save' }));
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith([
      {
        ...source,
        licenses: [
          origin.licenses[0],
          { ...custom, name: 'Corrected license', url: 'https://example.org/terms', text: 'Corrected terms' },
        ],
      },
    ]),
  );
});

it('cancels a license addition without changing source licenses', async () => {
  const onChange = jest.fn();
  render(<OriginsEditor context="word" value={[origin]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'edit_source' }));
  const sourceDialog = within(screen.getByRole('dialog', { name: 'edit_source' }));
  fireEvent.click(sourceDialog.getByRole('button', { name: 'add_license' }));
  const licenseDialog = within(screen.getByRole('dialog', { name: 'add_license' }));
  fireEvent.click(licenseDialog.getByRole('button', { name: 'cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'add_license' })).not.toBeInTheDocument());
  fireEvent.click(sourceDialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith([origin]));
});

it('keeps supplied standard license text when saving its dialog unchanged', async () => {
  const onChange = jest.fn();
  render(<OriginsEditor context="word" value={[origin]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'edit_source' }));
  const sourceDialog = within(screen.getByRole('dialog', { name: 'edit_source' }));
  fireEvent.click(sourceDialog.getByRole('button', { name: 'edit_license' }));
  const licenseDialog = within(screen.getByRole('dialog', { name: 'edit_license' }));
  fireEvent.click(licenseDialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'edit_license' })).not.toBeInTheDocument());
  fireEvent.click(sourceDialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls[0][0][0]).toMatchObject({ licenses: [{ text: origin.licenses[0].text }] });
});

it('corrects an existing dataset source without keeping word-specific metadata from the old form', async () => {
  const onChange = jest.fn();
  render(<OriginsEditor context="dataset" value={[origin]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'edit_source' }));
  const dialog = within(screen.getByRole('dialog', { name: 'edit_source' }));
  expect(dialog.queryByRole('textbox', { name: 'record_link' })).not.toBeInTheDocument();
  expect(dialog.queryByRole('combobox', { name: 'scope' })).not.toBeInTheDocument();
  expect(dialog.getByRole('textbox', { name: 'source_link' })).toHaveValue(origin.url);
  fireEvent.click(dialog.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const saved = onChange.mock.calls[0][0][0];
  const expected = { ...origin, scope: 'dataset' };
  delete expected.record_url;
  expect(saved).toEqual(expected);
});
