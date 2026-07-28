'use client';

import React from 'react';
import { App, Button, Progress, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ImportDictionaryChunkT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { formatTime } from './utils';
import styles from './styles.module.scss';

const { Text } = Typography;

export const ImportDictionarySection: React.FC = () => {
  const [percents, setPercents] = React.useState<number>(0);
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const [finished, setFinished] = React.useState<boolean>(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  React.useEffect(() => {
    if (!inProgress) return undefined;

    const startedAt = Date.now();
    setElapsedSeconds(0);

    const intervalId = setInterval(() => {
      setElapsedSeconds((Date.now() - startedAt) / 1000);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [inProgress]);

  const onError = (err: string) => message.error(tErr(err || 'unknown_error'));
  const importDictionary = async () => {
    setInProgress(true);
    const handleChunk = (c: ImportDictionaryChunkT) => {
      setPercents(+c.percent?.toFixed(2));
      setStatusMessage(t(`en_saving_${c.stage}`));
    };
    const res = await EnApi.importDictionary('0.0.1', handleChunk, onError);
    if ('error' in res) {
      message.error(tErr(res.message));
    }
    setInProgress(false);
    setFinished(true);
  };

  return (
    <div className={styles.importDictionarySection}>
      <Text strong>{t('your_version')}: 0.0.1</Text>
      <Text strong>{t('latest_version')}: 0.0.1</Text>
      <Progress
        className={styles.progress}
        percent={percents}
        status={inProgress ? 'active' : finished ? 'success' : 'normal'}
      />
      {!inProgress && !finished && (
        <Button type="primary" onClick={importDictionary} className={styles.startBtn}>
          {t('start_importing')}
        </Button>
      )}
      {inProgress && statusMessage && <Text italic>{statusMessage}</Text>}
      {(inProgress || finished) && (
        <Text type="secondary">
          {t('elapsed_time')}: {formatTime(elapsedSeconds)}
        </Text>
      )}
    </div>
  );
};
