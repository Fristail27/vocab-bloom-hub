'use client';

import React from 'react';
import { Alert, Collapse, Tag, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import type { OriginT } from 'server/types';

export const Origins: React.FC<{ origins?: OriginT[] | null; contribution?: boolean }> = ({
  origins,
  contribution = false,
}) => {
  const t = useTranslations('provenance');
  if (!origins?.length) return null;
  return (
    <Collapse
      items={origins.map((origin) => ({
        key: origin.id,
        label: (
          <>
            {contribution ? t('edited_in', { name: origin.name }) : origin.name} ·{' '}
            {origin.version ?? t('unknown_version')}{' '}
            {contribution
              ? origin.licenses.map((license, index) => <Tag key={index}>{license.spdx ?? license.name}</Tag>)
              : origin.inherited && <Tag>{t('inherited')}</Tag>}
          </>
        ),
        children: (
          <>
            {contribution && <Typography.Paragraph>{t('contribution_terms')}</Typography.Paragraph>}
            <Typography.Paragraph>{origin.attribution}</Typography.Paragraph>
            {origin.url && (
              <Typography.Paragraph>
                <a href={origin.url} target="_blank" rel="noreferrer noopener">
                  {t('source_link')}
                </a>
              </Typography.Paragraph>
            )}
            {origin.record_url && (
              <Typography.Paragraph>
                <a href={origin.record_url} target="_blank" rel="noreferrer noopener">
                  {t('record_link')}
                </a>
              </Typography.Paragraph>
            )}
            <Typography.Paragraph>{t(origin.license_relation === 'any' ? 'any' : 'all')}</Typography.Paragraph>
            <ul>
              {origin.licenses.map((license, index) => (
                <li key={index}>
                  <a href={license.url} target="_blank" rel="license noreferrer noopener">
                    {license.spdx ?? license.name}
                  </a>
                  {license.text && (
                    <details>
                      <summary>{t('license_text')}</summary>
                      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                        {license.text}
                      </Typography.Paragraph>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {origin.scope === 'dataset' && <Alert type="warning" title={t('undetailed')} />}
            {origin.method === 'manual' && (
              <Typography.Paragraph type="secondary">{t('manual')}</Typography.Paragraph>
            )}
            {origin.acquisitions?.map((event) => (
              <div key={event.id}>
                <Typography.Paragraph>
                  {t(event.method, {
                    name: (event.via ?? origin).name,
                    version: (event.via ?? origin).version ?? t('unknown_version'),
                  })}
                </Typography.Paragraph>
                {event.via?.url && (
                  <Typography.Paragraph>
                    <a href={event.via.url} target="_blank" rel="noreferrer noopener">
                      {t('source_link')}
                    </a>
                  </Typography.Paragraph>
                )}
                {event.recorded_at && (
                  <Typography.Paragraph>
                    <time dateTime={event.recorded_at}>{event.recorded_at.slice(0, 10)}</time>
                  </Typography.Paragraph>
                )}
              </div>
            ))}
            {origin.recorded_at && (
              <Typography.Paragraph>
                <time dateTime={origin.recorded_at}>{origin.recorded_at.slice(0, 10)}</time>
              </Typography.Paragraph>
            )}
            {origin.notices.map((notice, index) => (
              <Typography.Paragraph key={index} style={{ whiteSpace: 'pre-wrap' }}>
                {notice}
              </Typography.Paragraph>
            ))}
          </>
        ),
      }))}
    />
  );
};
