'use client';

import React from 'react';
import { App, Button, Input, Modal, Select, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import type { CopyWordSourceT, EnWordT, PublicSearchWordV1T } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { useEditedDataset } from '@/components/EditedDataset';
import { Origins } from './index';

export type CopyPreviewT = EnWordT & { copy_source: CopyWordSourceT };

export const CopyWordPicker: React.FC<{ onCopy: (word: CopyPreviewT) => void }> = ({ onCopy }) => {
  const t = useTranslations('provenance');
  const errors = useTranslations('errors');
  const { message } = App.useApp();
  const { datasets, edited } = useEditedDataset();
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<string>();
  const [items, setItems] = React.useState<PublicSearchWordV1T[]>([]);
  const [preview, setPreview] = React.useState<CopyPreviewT | null>(null);
  const [loading, setLoading] = React.useState(false);
  const request = React.useRef(0);
  if (!edited?.own) return null;
  const search = async (text: string) => {
    if (!source || !text.trim()) return;
    const current = ++request.current;
    setPreview(null);
    setLoading(true);
    const result = await EnApi.searchDataset(source, text.trim());
    if (current !== request.current) return;
    setLoading(false);
    if ('error' in result) message.error(errors(result.message));
    else setItems(result.filter((item) => item.form_of_word === 'base_form'));
  };
  const show = async (id: number) => {
    if (!source) return;
    const current = ++request.current;
    setPreview(null);
    setLoading(true);
    const result = await EnApi.previewCopy(source, id);
    if (current !== request.current) return;
    setLoading(false);
    if ('error' in result) message.error(errors(result.message));
    else setPreview(result);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('prefill')}</Button>
      <Modal
        open={open}
        title={t('prefill')}
        onCancel={() => {
          request.current++;
          setLoading(false);
          setOpen(false);
        }}
        width={720}
        okText={t('use_word')}
        cancelText={t('cancel')}
        okButtonProps={{ disabled: loading || !preview }}
        onOk={() => {
          if (preview) {
            onCopy(preview);
            setOpen(false);
          }
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Select
            aria-label={t('source')}
            placeholder={t('source')}
            value={source}
            style={{ width: '100%' }}
            options={datasets
              .filter((dataset) => dataset.name !== edited.name)
              .map((dataset) => ({ value: dataset.name, label: dataset.title }))}
            onChange={(value) => {
              request.current++;
              setSource(value);
              setItems([]);
              setPreview(null);
              setLoading(false);
            }}
          />
          <Input.Search
            aria-label={t('search')}
            placeholder={t('search')}
            disabled={!source}
            loading={loading}
            onSearch={(text) => void search(text)}
          />
          <Space wrap>
            {items.map((item) => (
              <Button key={item.id} onClick={() => void show(item.id)}>
                {item.word} · {item.part_of_speech.replaceAll('_', ' ')}
              </Button>
            ))}
          </Space>
          {preview && (
            <>
              <Typography.Title level={4}>{preview.word}</Typography.Title>
              <ul>
                {preview.meanings.map((meaning) => (
                  <li key={meaning.id}>
                    <strong>{meaning.title}</strong> {meaning.definition}
                  </li>
                ))}
              </ul>
              <Origins origins={preview.origins} />
              <Origins origins={preview.contributions} contribution />
            </>
          )}
        </Space>
      </Modal>
    </>
  );
};
