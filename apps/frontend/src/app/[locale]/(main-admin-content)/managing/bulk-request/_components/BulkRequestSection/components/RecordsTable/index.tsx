'use client';

import React from 'react';
import { Button, Table, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { BulkItemT, SourceKindE } from '../../types';
import { columnsFor } from './columns';
import styles from './styles.module.scss';

const { Text } = Typography;

type RecordsTableP = {
  kind: SourceKindE;
  items: BulkItemT[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  selected: Map<number, BulkItemT>;
  onSelectionChange: (next: Map<number, BulkItemT>) => void;
};

export const RecordsTable: React.FC<RecordsTableP> = ({
  kind,
  items,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  selected,
  onSelectionChange,
}) => {
  const t = useTranslations('bulk_request');
  const columns = React.useMemo(() => columnsFor(kind, t), [kind, t]);

  // Selection is kept by id across pages in the parent map; antd only knows the
  // keys of the current page, so rows are added / removed here explicitly
  const onSelectRows = (_keys: React.Key[], rows: BulkItemT[], info: { type: string }) => {
    const next = new Map(selected);
    const pageIds = new Set(items.map((i) => i.id));
    if (info.type === 'all' || info.type === 'none') {
      if (rows.length === 0) pageIds.forEach((id) => next.delete(id));
      else rows.forEach((r) => next.set(r.id, r));
    } else {
      pageIds.forEach((id) => next.delete(id));
      rows.forEach((r) => next.set(r.id, r));
    }
    onSelectionChange(next);
  };

  return (
    <div className={styles.table}>
      <div className={styles.toolbar}>
        <Text>{t('total_matching', { count: total })}</Text>
        <Text>{t('selected_count', { count: selected.size })}</Text>
        {selected.size > 0 && (
          <Button size="small" onClick={() => onSelectionChange(new Map())}>
            {t('clear_selection')}
          </Button>
        )}
      </div>
      <Table<BulkItemT>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={items}
        loading={loading}
        rowSelection={{
          selectedRowKeys: items.filter((i) => selected.has(i.id)).map((i) => i.id),
          onChange: onSelectRows,
          preserveSelectedRowKeys: true,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: onPageChange,
          showTotal: (count) => t('total_matching', { count }),
        }}
        scroll={{ x: true }}
      />
    </div>
  );
};
