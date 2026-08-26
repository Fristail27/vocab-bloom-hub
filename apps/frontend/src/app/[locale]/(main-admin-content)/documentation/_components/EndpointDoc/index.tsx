'use client';

import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ApiEndpointDocT } from '../../constants';
import { ApiPlayground } from '../ApiPlayground';
import { ParamsTable } from '../ParamsTable';
import styles from './styles.module.scss';

const { Text, Paragraph } = Typography;

const METHOD_COLORS: Record<ApiEndpointDocT['method'], string> = {
  GET: 'blue',
  POST: 'green',
};

type EndpointDocP = {
  endpoint: ApiEndpointDocT;
};

export const EndpointDoc: React.FC<EndpointDocP> = ({ endpoint }) => {
  const t = useTranslations('documentation');

  return (
    <div className={styles.endpointDoc}>
      <Card>
        <div className={styles.header}>
          <Tag color={METHOD_COLORS[endpoint.method]}>{endpoint.method}</Tag>
          <Text code copyable>
            {endpoint.path}
          </Text>
          <Tag color="success">{t('auth_public')}</Tag>
          {endpoint.throttle ? (
            <Tag>{t('rate_limit', { limit: endpoint.throttle.limit, seconds: endpoint.throttle.seconds })}</Tag>
          ) : (
            <Tag>{t('rate_limit_shared')}</Tag>
          )}
        </div>

        <Paragraph>{t(`desc_${endpoint.key}`)}</Paragraph>

        <Text strong>{t('response_type')}: </Text>
        <Text code>{endpoint.responseType}</Text>
      </Card>

      <Card title={t('request_params')}>
        <ParamsTable params={endpoint.params} />
      </Card>

      <Card title={t('try_it')}>
        <ApiPlayground endpoint={endpoint} />
      </Card>
    </div>
  );
};
