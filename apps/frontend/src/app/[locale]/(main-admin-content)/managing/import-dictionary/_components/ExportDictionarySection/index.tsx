'use client';

import React from 'react';
import { App, Button, Progress, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ImportDictionaryChunkT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

export const ExportDictionarySection: React.FC = () => {
  const [percents, setPercents] = React.useState<number>(0);
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const [finished, setFinished] = React.useState<boolean>(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const onError = (err: string) => message.error(tErr(err || 'unknown_error'));
  const importDictionary = async () => {
    setInProgress(true);
    const handleChunk = (c: ImportDictionaryChunkT) => {
      setPercents(+c.percent?.toFixed(2));
      setStatusMessage(t(`en_saving_${c.stage}`));
    };
    const res = await EnApi.exportDictionary(handleChunk, onError);
    if ('error' in res) {
      message.error(tErr(res.message));
    }
    setInProgress(false);
    setFinished(true);
  };

  return (
    <div className={styles.importDictionarySection}>
      <Progress percent={percents} status={inProgress ? 'active' : finished ? 'success' : 'normal'} />
      {!inProgress && !finished && (
        <Button type="primary" onClick={importDictionary} className={styles.startBtn}>
          {t('start_exporting')}
        </Button>
      )}
      {inProgress && statusMessage && <Text italic>{statusMessage}</Text>}
    </div>
  );
};
