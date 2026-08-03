'use client';

import React from 'react';
import { App, Button, Progress, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ImportDictionaryChunkT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { EnDictionaryImportPhasesE } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';
import { AbstractBaseApi } from '@/core/api/AbstractBaseApi';
import { ErrorCodes } from 'server/core/constants/error_codes';
import { ExportStatusE } from './constants';
import styles from './styles.module.scss';

const { Text } = Typography;

export const ExportDictionarySection: React.FC = () => {
  const [percents, setPercents] = React.useState<number>(0);
  const [status, setStatus] = React.useState<ExportStatusE>(ExportStatusE.idle);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const onError = React.useCallback(
    (err: string) => {
      message.error(tErr(err || ErrorCodes.unknown_error));
      setStatus(ExportStatusE.error);
    },
    [message, tErr],
  );

  const downloadAndSaveFile = async (exportId: string) => {
    const result = await EnApi.downloadExportedFile(exportId);

    if ('error' in result) {
      onError(result.message);
      return;
    }

    AbstractBaseApi.saveBlobAsFile(result.blob, result.filename ?? 'vocab-bloom-hub-en-export.zip');
    setStatus(ExportStatusE.success);
  };

  const exportDictionary = async () => {
    setStatus(ExportStatusE.in_progress);
    setPercents(0);
    setStatusMessage('');

    const handleChunk = (c: ImportDictionaryChunkT) => {
      if (c.stage === EnDictionaryImportPhasesE.completed) {
        setPercents(100);
        if (!c.exportId) {
          onError('unknown_error');
          return;
        }
        void downloadAndSaveFile(c.exportId);
      } else {
        setPercents(Number((c.percent ?? 0).toFixed(2)));
        setStatusMessage(t(`en_saving_${c.stage}`));
      }
    };

    const res = await EnApi.exportDictionary(handleChunk, onError);
    if ('error' in res) {
      onError(res.message);
    }
  };

  const resetAndRetry = () => {
    setStatus(ExportStatusE.idle);
    setPercents(0);
    setStatusMessage('');
  };

  const progressStatus =
    status === ExportStatusE.in_progress
      ? 'active'
      : status === 'success'
        ? 'success'
        : status === 'error'
          ? 'exception'
          : 'normal';

  return (
    <div className={styles.importDictionarySection}>
      <Progress percent={percents} status={progressStatus} />

      {(status === 'idle' || status === 'error') && (
        <Button type="primary" onClick={exportDictionary} className={styles.startBtn}>
          {status === 'error' ? t('retry_exporting') : t('start_exporting')}
        </Button>
      )}

      {status === 'success' && (
        <Button onClick={resetAndRetry} className={styles.startBtn}>
          {t('export_again')}
        </Button>
      )}

      {status === 'in_progress' && statusMessage && <Text italic>{statusMessage}</Text>}
    </div>
  );
};
