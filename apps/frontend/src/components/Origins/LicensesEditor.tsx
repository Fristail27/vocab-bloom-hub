'use client';

import React from 'react';
import { Button, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import type { OriginLicenseT } from 'server/types';
import { STANDARD_DATA_LICENSES } from 'server/core/constants/data_licenses';

type Values = { choice: string; name?: string; url?: string; text?: string };

export const LicensesEditor: React.FC<{
  value?: OriginLicenseT[];
  onChange?: (licenses: OriginLicenseT[]) => void;
}> = ({ value = [], onChange }) => {
  const t = useTranslations('provenance');
  const [editing, setEditing] = React.useState<{ index: number | null; license?: OriginLicenseT } | null>(null);
  const [form] = Form.useForm<Values>();
  const formName = React.useId();
  React.useEffect(() => {
    if (!editing) return;
    form.resetFields();
    const license = editing.license;
    form.setFieldsValue(
      license
        ? {
            ...license,
            choice: STANDARD_DATA_LICENSES.some((item) => item.spdx === license.spdx)
              ? license.spdx!
              : 'custom',
          }
        : { choice: 'CC-BY-4.0' },
    );
  }, [editing, form]);
  const save = (values: Values) => {
    if (!editing) return;
    const standard = STANDARD_DATA_LICENSES.find((item) => item.spdx === values.choice);
    const license: OriginLicenseT = standard
      ? {
          spdx: standard.spdx,
          name: standard.name,
          url: standard.url,
          ...(values.text && { text: values.text }),
        }
      : {
          ...(editing.license?.spdx &&
            !STANDARD_DATA_LICENSES.some((item) => item.spdx === editing.license?.spdx) && {
              spdx: editing.license.spdx,
            }),
          name: values.name!.trim(),
          url: values.url!.trim(),
          text: values.text!.trim(),
        };
    onChange?.(
      editing.index === null
        ? [...value, license]
        : value.map((old, index) => (index === editing.index ? license : old)),
    );
    setEditing(null);
  };
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {value.map((license, index) => (
        <Space key={index} wrap>
          <Typography.Link href={license.url} target="_blank" rel="noreferrer">
            {license.name}
          </Typography.Link>
          <Button size="small" onClick={() => setEditing({ index, license })}>
            {t('edit_license')}
          </Button>
          {value.length > 1 && (
            <Button size="small" danger onClick={() => onChange?.(value.filter((_, item) => item !== index))}>
              {t('remove')}
            </Button>
          )}
        </Space>
      ))}
      <Button onClick={() => setEditing({ index: null })}>{t('add_license')}</Button>
      <Modal
        open={editing !== null}
        title={t(editing?.index === null ? 'add_license' : 'edit_license')}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText={t('save')}
        cancelText={t('cancel')}
        destroyOnHidden
      >
        {/* This editor is also a Form.Item control; avoid nesting HTML forms through the modal portal. */}
        <Form form={form} name={formName} component={false} layout="vertical" onFinish={save}>
          <Form.Item name="choice" label={t('license')} rules={[{ required: true }]}>
            <Select
              onChange={() => form.setFieldsValue({ name: undefined, url: undefined, text: undefined })}
              options={[
                ...STANDARD_DATA_LICENSES.map((item) => ({ value: item.spdx, label: item.name })),
                { value: 'custom', label: t('custom') },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              form.getFieldValue('choice') === 'custom' ? (
                <>
                  <Form.Item
                    name="name"
                    label={t('license_name')}
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input maxLength={200} />
                  </Form.Item>
                  <Form.Item name="url" label={t('license_link')} rules={[{ required: true, type: 'url' }]}>
                    <Input type="url" maxLength={2000} />
                  </Form.Item>
                  <Form.Item
                    name="text"
                    label={t('license_text')}
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input.TextArea rows={5} maxLength={100000} />
                  </Form.Item>
                </>
              ) : (
                <Form.Item name="text" hidden>
                  <Input.TextArea />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
