'use client';

import React from 'react';
import { Alert, Button, Card, Collapse, Popconfirm, Tag, Typography } from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { DatasetCatalogEntryT } from 'server/core/constants/dataset_catalog';
import { findStandardLicense } from 'server/core/constants/data_licenses';
import { DEFAULT_DATASET_NAME } from 'server/core/constants/datasets';
import { DatasetT, DatasetUpdateT } from 'server/types';
import { formatCount, formatMegabytes } from '../../utils';
import styles from './styles.module.scss';

const { Paragraph, Text } = Typography;

/** What a card asks of the page: the dialogs and the calls live there, one of each for every card */
export type DatasetActionsT = {
  activate: (dataset: DatasetT) => void;
  edit: (dataset: DatasetT) => void;
  import: (dataset: DatasetT) => void;
  export: (dataset: DatasetT) => void;
  /** The instruction of a dataset of a public source: an installation, or an update from a newer file */
  install: (entry: DatasetCatalogEntryT) => void;
  editTerms: (dataset: DatasetT) => void;
  remove: (dataset: DatasetT) => void;
};

type DatasetCardP = {
  /** The entry of the catalog; absent for a dataset of the instance's own */
  entry?: DatasetCatalogEntryT | undefined;
  /** What the instance knows of it; absent or not installed for a dataset of the catalog it does not hold */
  dataset?: DatasetT | undefined;
  /** What its source has published (issue #530) */
  update?: DatasetUpdateT | undefined;
  /** false on SQLite: nothing is installed, activated or deleted */
  supported: boolean;
  /** The action under way, as the page names it: `activate <name>`, `delete <name>` */
  busy: string | null;
  actions: DatasetActionsT;
};

/**
 * One dataset on the datasets page (issues #527, #540): everything that is
 * done with it starts on its card — serving it, editing its words, the
 * import and the export, its terms. A line says what it is; what it holds
 * and the terms in full open under _Details_.
 */
export const DatasetCard: React.FC<DatasetCardP> = ({ entry, dataset, update, supported, busy, actions }) => {
  const locale = useLocale();
  const t = useTranslations('datasets');

  const name = dataset?.name ?? entry?.name ?? '';
  const title = dataset?.title ?? entry?.title ?? name;
  const installed = dataset?.installed ?? false;
  const active = dataset?.active ?? false;
  const own = dataset?.own ?? false;
  const fromSource = entry?.install.kind === 'convert';
  const license = entry
    ? { ...entry.license, share_alike: entry.share_alike }
    : (findStandardLicense(dataset?.license ?? '') ?? {
        spdx: null,
        name: dataset?.license ?? '',
        url: dataset?.license_url ?? '',
        share_alike: false,
      });
  const attribution = entry?.attribution ?? dataset?.attribution ?? '';
  const attributionUrl = entry ? entry.homepage : dataset?.attribution_url;
  const notice = entry?.notice || dataset?.notice || '';

  const details = (
    <div className={styles.detailsContent}>
      {entry && (
        <div className={styles.overview}>
          <Paragraph className={styles.description}>{t(`about_${entry.name}`)}</Paragraph>
          <div className={styles.features}>
            {entry.features.map((feature) => (
              <Tag key={feature}>{t(`feature_${feature}`)}</Tag>
            ))}
          </div>
        </div>
      )}
      <dl className={styles.facts}>
        <dt>{t('label_source')}</dt>
        <dd>
          {attributionUrl ? (
            <a href={attributionUrl} target="_blank" rel="noreferrer noopener">
              {attributionUrl.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <Text code>{dataset?.source ?? entry?.source}</Text>
          )}
        </dd>
        <dt>{t('label_attribution')}</dt>
        <dd>{attribution}</dd>
        {entry && (
          <>
            <dt>{t('label_size')}</dt>
            <dd>
              {t('size', {
                entries: formatCount(entry.size.entries, locale),
                senses: formatCount(entry.size.senses, locale),
                size: formatMegabytes(entry.size.database_mb, locale),
              })}
            </dd>
          </>
        )}
        {installed && update && (
          <>
            <dt>{t('label_source_version')}</dt>
            <dd data-testid={`dataset-source-version-${name}`}>
              {update.latest ?? t('source_unknown')}
              {update.checked_at && (
                <Text type="secondary" className={styles.checked}>
                  {t('source_checked', { date: new Date(update.checked_at).toLocaleString(locale) })}
                </Text>
              )}
            </dd>
          </>
        )}
        {own && dataset?.created_at && (
          <>
            <dt>{t('label_created')}</dt>
            <dd>{new Date(dataset.created_at).toLocaleString(locale)}</dd>
          </>
        )}
      </dl>
      {notice && (
        <div className={styles.notice}>
          <InfoCircleOutlined aria-hidden />
          <div>
            <Text strong>{t('label_notice')}</Text>
            <Paragraph>{notice}</Paragraph>
          </div>
        </div>
      )}
      {dataset?.license_text && (
        <div className={styles.licenseText}>
          <Text strong>{t('own_license_text')}</Text>
          <Paragraph>{dataset.license_text}</Paragraph>
        </div>
      )}
    </div>
  );

  return (
    <Card
      className={`${styles.card} ${active ? styles.active : ''}`}
      classNames={{ header: styles.cardHeader, title: styles.cardTitle, body: styles.cardBody }}
      data-testid={`dataset-${name}`}
      title={
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden>
              <DatabaseOutlined />
            </span>
            <div className={styles.heading}>
              <h4 className={styles.title}>{title}</h4>
              <Text type="secondary" className={styles.name}>
                {name}
              </Text>
            </div>
          </div>
          <div className={styles.tags}>
            {own && <Tag color="purple">{t('status_own')}</Tag>}
            {active && <Tag color="green">{t('status_active')}</Tag>}
            {installed && !active && <Tag color="blue">{t('status_installed')}</Tag>}
            {!installed && <Tag>{t('status_not_installed')}</Tag>}
          </div>
        </div>
      }
    >
      <dl className={styles.summary}>
        <div className={styles.license}>
          <dt>{t('label_license')}</dt>
          <dd data-testid={`dataset-license-${name}`}>
            <a href={license.url} target="_blank" rel="license noreferrer noopener">
              {license.spdx ? `${license.name} (${license.spdx})` : license.name}
            </a>
            {!license.spdx && <Tag className={styles.shareAlike}>{t('own_license_tag')}</Tag>}
            {license.share_alike && (
              <Tag color="orange" className={styles.shareAlike}>
                {t('share_alike')}
              </Tag>
            )}
          </dd>
        </div>
        {installed && (
          <>
            <div>
              <dt>{t('label_version')}</dt>
              <dd>{dataset?.version ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('label_imported')}</dt>
              <dd>
                {dataset?.imported_at ? new Date(dataset.imported_at).toLocaleString(locale) : t('never')}
              </dd>
            </div>
          </>
        )}
      </dl>

      {update?.installed && !update.comparable && (
        <Paragraph type="secondary" data-testid={`dataset-version-unknown-${name}`}>
          {t('version_unknown')}
        </Paragraph>
      )}
      {update?.update_available && (
        <Alert
          type="warning"
          showIcon
          className={styles.update}
          data-testid={`dataset-update-${name}`}
          title={t('update_available', { latest: update.latest ?? '', installed: update.installed ?? '' })}
          description={
            <>
              {t('update_hint')}{' '}
              {update.url && (
                <a href={update.url} target="_blank" rel="noreferrer noopener">
                  {t('update_open')}
                </a>
              )}
            </>
          }
        />
      )}

      <div className={styles.actions}>
        {supported && installed && !active && dataset && (
          <Popconfirm
            title={t('activate_confirm', { name: title })}
            okText={t('activate')}
            cancelText={t('cancel')}
            onConfirm={() => actions.activate(dataset)}
          >
            <Button type="primary" loading={busy === `activate ${name}`}>
              {t('activate')}
            </Button>
          </Popconfirm>
        )}
        {installed && dataset && (
          <Button
            icon={<EditOutlined aria-hidden />}
            onClick={() => actions.edit(dataset)}
            data-testid={`dataset-edit-words-${name}`}
          >
            {t('edit_words')}
          </Button>
        )}
        {fromSource && entry ? (
          <Button type={installed ? 'default' : 'primary'} onClick={() => actions.install(entry)}>
            {t(installed ? 'update' : 'how_to_install')}
          </Button>
        ) : (
          installed &&
          dataset && (
            <Button
              icon={<UploadOutlined aria-hidden />}
              onClick={() => actions.import(dataset)}
              data-testid={`dataset-import-${name}`}
            >
              {t('import')}
            </Button>
          )
        )}
        {installed && dataset && (
          <Button
            icon={<DownloadOutlined aria-hidden />}
            onClick={() => actions.export(dataset)}
            data-testid={`dataset-export-${name}`}
          >
            {t('export')}
          </Button>
        )}
        {own && dataset && (
          <Button
            icon={<FileTextOutlined aria-hidden />}
            onClick={() => actions.editTerms(dataset)}
            data-testid={`dataset-edit-${name}`}
          >
            {t('own_edit')}
          </Button>
        )}
        {supported && installed && !active && dataset && name !== DEFAULT_DATASET_NAME && (
          <Popconfirm
            title={t('delete_confirm', { name: title })}
            okText={t('delete')}
            okButtonProps={{ danger: true }}
            cancelText={t('cancel')}
            onConfirm={() => actions.remove(dataset)}
          >
            <Button
              danger
              type="text"
              icon={<DeleteOutlined aria-hidden />}
              className={styles.remove}
              loading={busy === `delete ${name}`}
            >
              {t('delete')}
            </Button>
          </Popconfirm>
        )}
      </div>

      <Collapse
        ghost
        expandIconPlacement="end"
        className={styles.details}
        classNames={{ header: styles.detailsHeader }}
        styles={{
          root: { borderBlockStart: '1px solid var(--ant-color-border-secondary)' },
          header: { padding: '14px var(--dataset-card-padding)' },
          body: { padding: '20px var(--dataset-card-padding) 24px' },
        }}
        items={[
          {
            key: 'details',
            label: (
              <span className={styles.detailsLabel}>
                <InfoCircleOutlined aria-hidden />
                {t('details')}
              </span>
            ),
            children: details,
            forceRender: true,
          },
        ]}
      />
    </Card>
  );
};
