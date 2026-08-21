'use client';

import React from 'react';
import { Input as AntdInput, InputNumber, Radio, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { AuthHeaderModeE, BulkItemT, BulkRequestConfigT, ResponseMapperIdE, SourceKindE } from '../../types';
import { MAX_CONCURRENCY, MAX_RETRIES, MIN_CONCURRENCY } from '../../constants';
import { SOURCE_KINDS, SOURCE_PLACEHOLDERS, toTemplateVars } from '../../sources';
import { buildRequestBody } from '../../utils/renderTemplate';
import { parseResponsePath } from '../../utils/responseMappers';
import styles from './styles.module.scss';

const { Text, Paragraph } = Typography;
const { TextArea, Password } = AntdInput;

type RequestConfigFormP = {
  config: BulkRequestConfigT;
  onChange: (patch: Partial<BulkRequestConfigT>) => void;
  sourceKind: SourceKindE;
  onSourceKindChange: (kind: SourceKindE) => void;
  // the first listed row of the chosen table, used to render the request preview
  previewItem?: BulkItemT | undefined;
};

/** Builds the preview body for one row; null when the template is not valid JSON */
export const renderPreview = (
  config: BulkRequestConfigT,
  sourceKind: SourceKindE,
  item: BulkItemT | undefined,
): string | null => {
  if (!item) return '';
  try {
    return JSON.stringify(
      JSON.parse(
        buildRequestBody(config.bodyTemplate, config.promptTemplate, toTemplateVars(sourceKind, item)),
      ),
      null,
      2,
    );
  } catch {
    return null;
  }
};

export const RequestConfigForm: React.FC<RequestConfigFormP> = ({
  config,
  onChange,
  sourceKind,
  onSourceKindChange,
  previewItem,
}) => {
  const t = useTranslations('bulk_request');
  const preview = React.useMemo(
    () => renderPreview(config, sourceKind, previewItem),
    [config, sourceKind, previewItem],
  );
  const placeholders = SOURCE_PLACEHOLDERS[sourceKind].map((p) => `{{${p}}}`).join(', ');
  const responsePathValid = parseResponsePath(config.responsePath) !== null;

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <Text strong>{t('source_table')}</Text>
        <Radio.Group
          value={sourceKind}
          onChange={(e) => onSourceKindChange(e.target.value as SourceKindE)}
          data-testid="bulk-source"
        >
          {SOURCE_KINDS.map((kind) => (
            <Radio key={kind} value={kind} data-testid={`bulk-source-${kind}`}>
              {t(`source_${kind}`)}
            </Radio>
          ))}
        </Radio.Group>
        <Text type="secondary">{t('source_hint')}</Text>
      </div>

      <Input
        label={t('url')}
        placeholder={t('url_placeholder')}
        value={config.url}
        status={config.url.trim() ? undefined : 'error'}
        onChange={(e) => onChange({ url: e.target.value })}
        data-testid="bulk-url"
      />

      <div className={styles.field}>
        <Text strong>{t('api_key')}</Text>
        {/* The key lives only in component state: no autocomplete, no storage, never sent to our API */}
        <Password
          value={config.apiKey}
          autoComplete="off"
          onChange={(e) => onChange({ apiKey: e.target.value })}
          data-testid="bulk-api-key"
        />
        <Text type="secondary">{t('api_key_hint')}</Text>
      </div>

      <div className={styles.row}>
        <Select<AuthHeaderModeE>
          label={t('auth_header')}
          value={config.authHeaderMode}
          onChange={(authHeaderMode) => onChange({ authHeaderMode })}
          options={[
            { value: AuthHeaderModeE.bearer, label: t('auth_bearer') },
            { value: AuthHeaderModeE.x_api_key, label: t('auth_x_api_key') },
            { value: AuthHeaderModeE.custom, label: t('auth_custom') },
          ]}
          containerClassName={styles.grow}
        />
        {config.authHeaderMode === AuthHeaderModeE.custom && (
          <Input
            label={t('custom_auth_header_name')}
            value={config.customAuthHeaderName}
            onChange={(e) => onChange({ customAuthHeaderName: e.target.value })}
          />
        )}
      </div>

      <div className={styles.field}>
        <Text strong>{t('extra_headers')}</Text>
        <TextArea
          value={config.extraHeaders}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onChange={(e) => onChange({ extraHeaders: e.target.value })}
        />
        <Text type="secondary">{t('extra_headers_hint')}</Text>
      </div>

      <div className={styles.field}>
        <Text strong>{t('prompt_template')}</Text>
        <TextArea
          value={config.promptTemplate}
          autoSize={{ minRows: 2, maxRows: 8 }}
          onChange={(e) => onChange({ promptTemplate: e.target.value })}
          data-testid="bulk-prompt"
        />
        <Text type="secondary" data-testid="bulk-placeholders">
          {t('prompt_template_hint', { placeholders })}
        </Text>
      </div>

      <div className={styles.field}>
        <Text strong>{t('body_template')}</Text>
        <TextArea
          value={config.bodyTemplate}
          autoSize={{ minRows: 3, maxRows: 12 }}
          status={preview === null ? 'error' : undefined}
          onChange={(e) => onChange({ bodyTemplate: e.target.value })}
          data-testid="bulk-body"
        />
        <Text type={preview === null ? 'danger' : 'secondary'}>
          {preview === null ? t('body_template_invalid') : t('body_template_hint')}
        </Text>
      </div>

      <div className={styles.row}>
        <Select<ResponseMapperIdE>
          label={t('mapper')}
          value={config.mapper}
          onChange={(mapper) => onChange({ mapper })}
          options={[
            { value: ResponseMapperIdE.json_in_text, label: t('mapper_json_in_text') },
            { value: ResponseMapperIdE.json_body, label: t('mapper_json_body') },
            { value: ResponseMapperIdE.text, label: t('mapper_text') },
          ]}
          containerClassName={styles.grow}
        />
        <div className={styles.grow}>
          <Input
            label={t('response_path')}
            placeholder={t('response_path_placeholder')}
            value={config.responsePath}
            status={responsePathValid ? undefined : 'error'}
            onChange={(e) => onChange({ responsePath: e.target.value })}
            allowClear
            data-testid="bulk-response-path"
          />
          <Text type={responsePathValid ? 'secondary' : 'danger'}>
            {responsePathValid ? t('response_path_hint') : t('response_path_invalid')}
          </Text>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <Text strong>{t('concurrency')}</Text>
          <InputNumber
            min={MIN_CONCURRENCY}
            max={MAX_CONCURRENCY}
            value={config.concurrency}
            onChange={(v) =>
              onChange({ concurrency: Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, v ?? 1)) })
            }
            data-testid="bulk-concurrency"
          />
        </div>
        <div className={styles.field}>
          <Text strong>{t('max_retries')}</Text>
          <InputNumber
            min={0}
            max={MAX_RETRIES}
            value={config.maxRetries}
            onChange={(v) => onChange({ maxRetries: Math.min(MAX_RETRIES, Math.max(0, v ?? 0)) })}
          />
        </div>
      </div>

      {preview && (
        <div className={styles.field}>
          <Text strong>{t('request_preview')}</Text>
          <Paragraph>
            <pre className={styles.preview} data-testid="bulk-preview">
              {preview}
            </pre>
          </Paragraph>
        </div>
      )}
    </div>
  );
};
