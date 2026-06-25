'use client';

import React from 'react';
import { App, Button, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

export const ImportDictionarySection: React.FC = () => {
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const importDictionary = async () => {
    const res = await EnApi.importDictionary('0.0.1');
    if ('error' in res) {
      message.error(tErr(res.message));
    } else {
      console.log(res);
    }
  };
  return (
    <div className={styles.importDictionarySection}>
      <Text strong>{t('your_version')}: 0.0.1</Text>
      <Text strong>{t('latest_version')}: 0.0.1</Text>
      <Button type="primary" onClick={importDictionary} className={styles.startBtn}>
        {t('start_importing')}
      </Button>
    </div>
  );
};
