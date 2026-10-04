'use client';

import React from 'react';
import { App, Button, Input, Modal, Space } from 'antd';
import { useTranslations } from 'next-intl';
import type { OriginT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { Origins } from './index';
import { OriginsEditor } from './Editor';

export const WordOrigins: React.FC<{
  id: number;
  origins?: OriginT[] | null;
  contributions?: OriginT[];
  editable: boolean;
  onSaved: () => void;
}> = ({ id, origins, contributions, editable, onSaved }) => {
  const t = useTranslations('provenance');
  const errors = useTranslations('errors');
  const { message } = App.useApp();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<OriginT[]>([]);
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    const result = await EnApi.updateOrigins(id, { origins: draft, reason: reason.trim() });
    setSaving(false);
    if ('error' in result) message.error(errors(result.message));
    else {
      setOpen(false);
      onSaved();
    }
  };
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Origins origins={origins} />
      <Origins origins={contributions} contribution />
      {editable && (
        <Button
          onClick={() => {
            setDraft(origins ?? []);
            setReason('');
            setOpen(true);
          }}
        >
          {t('edit_sources')}
        </Button>
      )}
      <Modal
        title={t('sources')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okButtonProps={{ disabled: !reason.trim() }}
        okText={t('save')}
        cancelText={t('cancel')}
        width={700}
      >
        <OriginsEditor context="word" value={draft} onChange={setDraft} />
        <label htmlFor="origin-reason">{t('reason')}</label>
        <Input.TextArea
          id="origin-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          rows={3}
        />
      </Modal>
    </Space>
  );
};
