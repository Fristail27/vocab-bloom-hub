'use client';

import React from 'react';
import { OriginsEditor } from '@/components/Origins/Editor';
import { Origins } from '@/components/Origins';
import type { OriginT, ForkProgressT } from 'server/types';
import { Alert, App, Checkbox, Form, Input, Modal, Select, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { isReservedDatasetName } from 'server/core/constants/dataset_catalog';
import {
  CUSTOM_LICENSE_NAME_MAX_LENGTH,
  DATASET_ATTRIBUTION_MAX_LENGTH,
  DATASET_TITLE_MAX_LENGTH,
  STANDARD_DATA_LICENSES,
  findStandardLicense,
} from 'server/core/constants/data_licenses';
import { DATASET_NAME_PATTERN, DATASET_VERSION_MAX_LENGTH } from 'server/core/constants/datasets';
import { DatasetLicenseReqT, DatasetT, UpdateDatasetReqT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Paragraph } = Typography;

/** The option of the select that opens the fields of a license of the owner's own */
export const OWN_LICENSE = 'own';

type FormValuesT = {
  version?: string;
  description?: string;
  notice?: string;
  origins?: OriginT[];
  name: string;
  title: string;
  license: string;
  license_name?: string;
  license_url?: string;
  license_text?: string;
  attribution: string;
  attribution_url?: string;
};

type OwnDatasetFormP = {
  /** Open for a new dataset; closed when false */
  open: boolean;
  parent?: DatasetT | undefined;
  onForkStarted?: (progress: ForkProgressT) => void;
  /** The dataset whose terms are edited; absent for a new one */
  dataset?: DatasetT | undefined;
  onClose: () => void;
  /** Called with the dataset as the server answered it */
  onSaved: (dataset: DatasetT) => void;
};

const licenseOf = (values: FormValuesT): DatasetLicenseReqT =>
  values.license === OWN_LICENSE
    ? { name: values.license_name ?? '', url: values.license_url ?? '', text: values.license_text ?? '' }
    : { spdx: values.license };

const initialOf = (dataset: DatasetT | undefined): Partial<FormValuesT> => {
  if (!dataset) return { license: STANDARD_DATA_LICENSES[1]?.spdx };
  const standard = findStandardLicense(dataset.license);
  return {
    name: dataset.name,
    description: dataset.description ?? '',
    notice: dataset.notice ?? '',
    origins: dataset.origins ?? [],
    title: dataset.title,
    version: dataset.version ?? '',
    license: standard ? standard.spdx : OWN_LICENSE,
    ...(!standard && {
      license_name: dataset.license,
      license_url: dataset.license_url,
      license_text: dataset.license_text ?? '',
    }),
    attribution: dataset.attribution,
    attribution_url: dataset.attribution_url ?? '',
  };
};

const sameLicense = (dataset: DatasetT, license: DatasetLicenseReqT): boolean =>
  license.spdx !== undefined
    ? license.spdx === dataset.license
    : license.name?.trim() === dataset.license &&
      license.url?.trim() === dataset.license_url &&
      license.text?.trim() === (dataset.license_text ?? '');

/**
 * A dataset of the instance's own (issue #540): created empty under a
 * license the owner chooses — one of the list, or a license of their own
 * with its text in full — and its terms corrected later. A new license is
 * a decision: the dialog says what the change does and does not do, and
 * asks for it to be confirmed before it is sent.
 */
export const OwnDatasetForm: React.FC<OwnDatasetFormP> = ({
  open,
  dataset,
  parent,
  onForkStarted,
  onClose,
  onSaved,
}) => {
  const t = useTranslations('datasets');
  const p = useTranslations('provenance');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValuesT>();
  const [saving, setSaving] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  const license = Form.useWatch('license', form);
  const licenseName = Form.useWatch('license_name', form);
  const licenseUrl = Form.useWatch('license_url', form);
  const licenseText = Form.useWatch('license_text', form);
  const editing = !!dataset;
  const licenseChanged =
    editing &&
    !!license &&
    !sameLicense(
      dataset,
      licenseOf({
        license,
        license_name: licenseName,
        license_url: licenseUrl,
        license_text: licenseText,
      } as FormValuesT),
    );

  React.useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initialOf(dataset ?? parent));
    if (parent)
      form.setFieldsValue({
        name: '',
        title: p('fork_name', { name: parent.title }),
        version: '',
        description: '',
        origins: [],
      });
    setConfirmed(false);
  }, [open, dataset, parent, form, p]);

  const submit = async (values: FormValuesT) => {
    setSaving(true);
    const terms = {
      title: values.title,
      version: values.version?.trim() || null,
      description: values.description?.trim() || null,
      notice: values.notice?.trim() || null,
      origins: values.origins ?? [],
      attribution: values.attribution,
      attribution_url: values.attribution_url?.trim() || null,
    };
    if (parent) {
      const fork = await EnApi.forkDataset(parent.name, {
        ...terms,
        name: values.name,
        license: licenseOf(values),
      });
      setSaving(false);
      if ('error' in fork) message.error(tErr(fork.message));
      else onForkStarted?.(fork);
      return;
    }
    const res = dataset
      ? await EnApi.updateDataset(dataset.name, {
          ...terms,
          ...(licenseChanged && { license: licenseOf(values) }),
        } satisfies UpdateDatasetReqT)
      : await EnApi.createDataset({ ...terms, name: values.name, license: licenseOf(values) });
    setSaving(false);
    if ('error' in res) {
      message.error(tErr(res.message));
      return;
    }
    message.success(dataset ? t('own_saved') : t('own_created', { name: res.title }));
    onSaved(res);
  };

  return (
    <Modal
      open={open}
      title={
        parent
          ? p('fork_button')
          : dataset
            ? t('own_edit_title', { name: dataset.title })
            : t('own_create_title')
      }
      okText={dataset ? t('own_save') : t('own_create')}
      cancelText={t('cancel')}
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={saving}
      okButtonProps={{ disabled: licenseChanged && !confirmed }}
      mask={{ closable: true }}
      destroyOnHidden
      width={640}
    >
      <Form<FormValuesT>
        form={form}
        layout="vertical"
        onFinish={(values) => void submit(values)}
        data-testid="own-dataset-form"
        className={styles.form}
      >
        {parent && (
          <Alert
            type="info"
            title={p('fork', { name: parent.title, version: parent.version ?? p('unknown_version') })}
          />
        )}
        {parent && <Origins origins={parent.origins} />}
        {!editing && (
          <Form.Item
            name="name"
            label={t('own_field_name')}
            extra={t('own_field_name_hint')}
            rules={[
              { required: true, message: t('own_required') },
              { pattern: DATASET_NAME_PATTERN, message: t('own_name_pattern') },
              {
                validator: async (_, value: string) => {
                  if (value && isReservedDatasetName(value)) throw new Error(t('own_name_reserved'));
                },
              },
            ]}
          >
            <Input autoComplete="off" spellCheck={false} data-testid="own-dataset-name" />
          </Form.Item>
        )}
        <Form.Item
          name="title"
          label={t('own_field_title')}
          rules={[{ required: true, whitespace: true, message: t('own_required') }]}
        >
          <Input maxLength={DATASET_TITLE_MAX_LENGTH} data-testid="own-dataset-title" />
        </Form.Item>
        <Form.Item name="version" label={t('own_field_version')} extra={t('own_field_version_hint')}>
          <Input maxLength={DATASET_VERSION_MAX_LENGTH} placeholder="1.0.0" data-testid="own-dataset-version" />
        </Form.Item>
        <Form.Item name="description" label={p('description')}>
          <Input.TextArea rows={3} maxLength={10000} />
        </Form.Item>
        <Form.Item name="notice" label={p('dataset_notice')}>
          <Input.TextArea rows={3} maxLength={10000} />
        </Form.Item>
        <Form.Item name="origins" label={p('sources')}>
          <OriginsEditor context="dataset" />
        </Form.Item>
        <Form.Item name="license" label={t('label_license')} rules={[{ required: true }]}>
          <Select
            data-testid="own-dataset-license"
            options={[
              ...STANDARD_DATA_LICENSES.map((item) => ({
                value: item.spdx,
                label: `${item.name} (${item.spdx})`,
              })),
              { value: OWN_LICENSE, label: t('own_license_own') },
            ]}
          />
        </Form.Item>
        {license === OWN_LICENSE && (
          <>
            <Paragraph type="secondary">{t('own_license_own_hint')}</Paragraph>
            <Form.Item
              name="license_name"
              label={t('own_field_license_name')}
              rules={[
                { required: true, whitespace: true, message: t('own_required') },
                {
                  validator: async (_, value: string) => {
                    if (value && findStandardLicense(value.trim()))
                      throw new Error(t('own_license_is_standard'));
                  },
                },
              ]}
            >
              <Input maxLength={CUSTOM_LICENSE_NAME_MAX_LENGTH} data-testid="own-dataset-license-name" />
            </Form.Item>
            <Form.Item
              name="license_url"
              label={t('own_field_license_url')}
              rules={[
                { required: true, message: t('own_required') },
                { type: 'url', message: t('own_url_invalid') },
              ]}
            >
              <Input type="url" data-testid="own-dataset-license-url" />
            </Form.Item>
            <Form.Item
              name="license_text"
              label={t('own_field_license_text')}
              rules={[{ required: true, whitespace: true, message: t('own_required') }]}
            >
              <Input.TextArea rows={6} data-testid="own-dataset-license-text" />
            </Form.Item>
          </>
        )}
        {licenseChanged && (
          <Alert
            type="warning"
            showIcon
            className={styles.warning}
            data-testid="own-dataset-license-warning"
            title={t('own_license_change_title')}
            description={
              <>
                <ul className={styles.points}>
                  <li>{t('own_license_change_given')}</li>
                  <li>{t('own_license_change_reports')}</li>
                  <li>{t('own_license_change_served')}</li>
                  <li>{t('own_license_change_journal')}</li>
                </ul>
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  data-testid="own-dataset-license-confirm"
                >
                  {t('own_license_change_confirm')}
                </Checkbox>
              </>
            }
          />
        )}
        <Form.Item
          name="attribution"
          label={t('label_attribution')}
          extra={t('own_field_attribution_hint')}
          rules={[{ required: true, whitespace: true, message: t('own_required') }]}
        >
          <Input.TextArea
            rows={2}
            maxLength={DATASET_ATTRIBUTION_MAX_LENGTH}
            data-testid="own-dataset-attribution"
          />
        </Form.Item>
        <Form.Item
          name="attribution_url"
          label={t('own_field_attribution_url')}
          rules={[{ type: 'url', message: t('own_url_invalid') }]}
        >
          <Input type="url" data-testid="own-dataset-attribution-url" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
