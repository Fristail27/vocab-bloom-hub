'use client';

import React from 'react';
import { App, Button, Progress, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ImportDictionaryChunkT } from 'server/types';
import { EnDictionaryImportPhasesE } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';
import { ErrorCodes } from 'server/core/constants/error_codes';
import { EnApi } from '@/core/api/EnApi';
import { formatTime, getDownloadProgressStr } from './utils';
import { ImportStatusE } from './constants';
import styles from './styles.module.scss';

const { Text } = Typography;

type ImportDictionarySectionP = {
  // dataset version of the last successful import, from the settings store
  yourVersion?: string | undefined;
};

export const ImportDictionarySection: React.FC<ImportDictionarySectionP> = ({ yourVersion }) => {
  const [percents, setPercents] = React.useState<number>(0);
  const [status, setStatus] = React.useState<ImportStatusE>(ImportStatusE.idle);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [installedVersion, setInstalledVersion] = React.useState<string | undefined>(yourVersion);
  const [latestVersion, setLatestVersion] = React.useState<string | undefined>(undefined);
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const inProgress = status === ImportStatusE.in_progress;

  React.useEffect(() => {
    if (!inProgress) return undefined;

    const startedAt = Date.now();
    setElapsedSeconds(0);

    const intervalId = setInterval(() => {
      setElapsedSeconds((Date.now() - startedAt) / 1000);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [inProgress]);

  const onError = React.useCallback(
    (err: string) => {
      message.error(tErr(err || ErrorCodes.unknown_error));
      setStatus(ImportStatusE.error);
    },
    [message, tErr],
  );

  const importDictionary = async () => {
    setStatus(ImportStatusE.in_progress);
    setPercents(0);
    setStatusMessage('');

    let completedSeen = false;
    let seenDatasetVersion: string | undefined;

    const handleChunk = (c: ImportDictionaryChunkT) => {
      const percent = Math.min(100, Math.max(0, c.percent ?? 0));

      if (c.datasetVersion) {
        seenDatasetVersion = c.datasetVersion;
        setLatestVersion(c.datasetVersion);
      }

      if (c.stage === EnDictionaryImportPhasesE.completed) {
        completedSeen = true;
        setPercents(100);
        setStatusMessage('');
      } else if (c.stage === EnDictionaryImportPhasesE.downloading_database) {
        const progressPart = getDownloadProgressStr(c);
        setStatusMessage(`${t(`en_saving_${c.stage}`)} ${progressPart} ${percent.toFixed(2)}%`);
      } else {
        setPercents(Number(percent.toFixed(2)));
        setStatusMessage(t(`en_saving_${c.stage}`));
      }
    };

    const res = await EnApi.importDictionary(handleChunk, onError);
    if ('error' in res) {
      onError(res.message);
      return;
    }

    // Стрим закончился без чанка completed — сервер оборвал импорт.
    if (!completedSeen) {
      onError(ErrorCodes.unknown_error);
      return;
    }

    if (seenDatasetVersion) {
      setInstalledVersion(seenDatasetVersion);
    }
    setStatus(ImportStatusE.success);
  };

  const progressStatus =
    status === ImportStatusE.in_progress
      ? 'active'
      : status === ImportStatusE.success
        ? 'success'
        : status === ImportStatusE.error
          ? 'exception'
          : 'normal';

  return (
    <div className={styles.importDictionarySection}>
      <Text strong>
        {t('your_version')}: {installedVersion || '—'}
      </Text>
      <Text strong>
        {t('latest_version')}: {latestVersion || '—'}
      </Text>
      <Progress
        className={styles.progress}
        percent={percents}
        status={progressStatus}
        format={(p = 0) => `${p.toFixed(2)}%`}
      />
      {(status === ImportStatusE.idle || status === ImportStatusE.error) && (
        <Button type="primary" onClick={importDictionary} className={styles.startBtn}>
          {status === ImportStatusE.error ? t('retry_importing') : t('start_importing')}
        </Button>
      )}
      {inProgress && statusMessage && <Text italic>{statusMessage}</Text>}
      {status !== ImportStatusE.idle && (
        <Text type="secondary">
          {t('elapsed_time')}: {formatTime(elapsedSeconds)}
        </Text>
      )}
    </div>
  );
};
