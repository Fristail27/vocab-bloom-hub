'use client';

import React from 'react';
import { Button, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import type { OriginT } from 'server/types';
import { STANDARD_DATA_LICENSES } from 'server/core/constants/data_licenses';
import { Origins } from './index';
import { LicensesEditor } from './LicensesEditor';

type Values = {
  name: string;
  version?: string;
  url?: string;
  record_url?: string;
  attribution: string;
  notices?: string;
  scope: OriginT['scope'];
  license_relation: OriginT['license_relation'];
  licenses: OriginT['licenses'];
};

/** Controlled input usable both in dataset settings and on an individual word. */
export const OriginsEditor: React.FC<{
  context: 'word' | 'dataset';
  value?: OriginT[];
  onChange?: (origins: OriginT[]) => void;
}> = ({ context, value = [], onChange }) => {
  const t = useTranslations('provenance');
  const [editing, setEditing] = React.useState<OriginT | 'new' | null>(null);
  const [form] = Form.useForm<Values>();
  const formName = React.useId();
  const open = (origin: OriginT | 'new') => setEditing(origin);
  React.useEffect(() => {
    if (!editing) return;
    const origin = editing;
    form.resetFields();
    form.setFieldsValue(
      origin === 'new'
        ? {
            scope: context,
            license_relation: 'all',
            licenses: STANDARD_DATA_LICENSES.filter((license) => license.spdx === 'CC-BY-4.0').map(
              ({ spdx, name, url }) => ({ spdx, name, url }),
            ),
          }
        : {
            ...origin,
            version: origin.version ?? '',
            notices: origin.notices.join('\n\n'),
          },
    );
  }, [context, editing, form]);
  const save = (values: Values) => {
    const origin: OriginT = {
      id: editing && editing !== 'new' ? editing.id : crypto.randomUUID(),
      name: values.name.trim(),
      version: values.version?.trim() || null,
      ...(values.url?.trim() && { url: values.url.trim() }),
      ...(context === 'word' && values.record_url?.trim() && { record_url: values.record_url.trim() }),
      attribution: values.attribution.trim(),
      notices: values.notices?.trim() ? [values.notices.trim()] : [],
      scope: context === 'dataset' ? 'dataset' : values.scope,
      license_relation: values.license_relation,
      method: 'manual',
      inherited: false,
      recorded_at: editing && editing !== 'new' ? editing.recorded_at : new Date().toISOString(),
      licenses: values.licenses,
    };
    onChange?.(
      editing === 'new' ? [...value, origin] : value.map((old) => (old.id === origin.id ? origin : old)),
    );
    setEditing(null);
  };
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Origins origins={value} />
      {value
        .filter((origin) => !origin.inherited)
        .map((origin) => (
          <Space key={origin.id} wrap>
            <Typography.Text>{origin.name}</Typography.Text>
            <Button size="small" onClick={() => open(origin)}>
              {t('edit_source')}
            </Button>
            <Button
              size="small"
              danger
              onClick={() => onChange?.(value.filter((item) => item.id !== origin.id))}
            >
              {t('remove')}
            </Button>
          </Space>
        ))}
      <Button onClick={() => open('new')}>{t('add_source')}</Button>
      <Modal
        open={editing !== null}
        title={t(editing === 'new' ? 'add_source' : 'edit_source')}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText={t('save')}
        cancelText={t('cancel')}
        width={660}
        destroyOnHidden
      >
        <Form form={form} name={formName} layout="vertical" onFinish={save}>
          <Form.Item name="name" label={t('source_name')} rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="version" label={t('version')} extra={t('unknown_hint')}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="url" label={t('source_link')} rules={[{ type: 'url' }]}>
            <Input type="url" />
          </Form.Item>
          {context === 'word' && (
            <Form.Item name="record_url" label={t('record_link')} rules={[{ type: 'url' }]}>
              <Input type="url" />
            </Form.Item>
          )}
          <Form.Item name="attribution" label={t('attribution')} rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={2} maxLength={10000} />
          </Form.Item>
          <Form.Item name="notices" label={t('notices')}>
            <Input.TextArea rows={3} maxLength={100000} />
          </Form.Item>
          {context === 'word' && (
            <Form.Item name="scope" label={t('scope')}>
              <Select options={['word', 'dataset'].map((item) => ({ value: item, label: t(item) }))} />
            </Form.Item>
          )}
          <Form.Item name="license_relation" label={t('licenses')}>
            <Select options={['all', 'any'].map((item) => ({ value: item, label: t(item) }))} />
          </Form.Item>
          <Form.Item
            name="licenses"
            label={t('source_licenses')}
            rules={[{ type: 'array', min: 1, required: true }]}
          >
            <LicensesEditor />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
