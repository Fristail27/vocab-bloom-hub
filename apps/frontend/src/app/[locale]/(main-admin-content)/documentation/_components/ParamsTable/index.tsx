'use client';

import React from 'react';
import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { ApiParamDocT } from '../../constants';
import styles from './styles.module.scss';

const { Text } = Typography;

type ParamsTableP = {
  params: ApiParamDocT[];
};

const describeLimitations = (param: ApiParamDocT): string => {
  if (param.options?.length) return param.options.join(' | ');
  if (param.min !== undefined && param.max !== undefined) return `${param.min}–${param.max}`;
  return param.constraints ?? '—';
};

export const ParamsTable: React.FC<ParamsTableP> = ({ params }) => {
  const t = useTranslations('documentation');

  const columns: ColumnsType<ApiParamDocT> = [
    {
      title: t('col_param'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text code className={styles.code}>
          {name}
        </Text>
      ),
    },
    {
      title: t('col_type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Text code className={styles.code}>
          {type}
        </Text>
      ),
    },
    {
      title: t('col_required'),
      dataIndex: 'required',
      key: 'required',
      render: (required: boolean) => (
        <Tag color={required ? 'error' : 'default'}>{required ? t('yes') : t('no')}</Tag>
      ),
    },
    {
      title: t('col_default'),
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (defaultValue: ApiParamDocT['defaultValue']) =>
        defaultValue === undefined ? (
          '—'
        ) : (
          <Text code className={styles.code}>
            {String(defaultValue)}
          </Text>
        ),
    },
    {
      title: t('col_constraints'),
      key: 'constraints',
      render: (_, param) => describeLimitations(param),
    },
    {
      title: t('col_description'),
      key: 'description',
      render: (_, param) => t(`param_desc_${param.name}`),
    },
  ];

  return (
    <Table<ApiParamDocT>
      rowKey="name"
      size="small"
      pagination={false}
      dataSource={params}
      columns={columns}
      scroll={{ x: true }}
    />
  );
};
