'use client';

import React from 'react';
import { App, Button, Progress, Tabs, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { ImportDictionaryChunkT, ImportSourceFileT, ImportSourceKindE } from 'server/types';
import { EnDictionaryImportPhasesE } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';
import { ErrorCodes } from 'server/core/constants/error_codes';
import { EnApi } from '@/core/api/EnApi';
import { useImportStatus } from '@/components/AutoImportBanner/useImportStatus';
import { formatTime, getDownloadProgressStr } from './utils';
import { ImportStatusE } from './constants';
import { ImportSourceTabE, ManifestModeE, ManualManifestT, SlotFilesT } from './types';
import { ArchiveSource } from './components/ArchiveSource';
import { JSONL_SLOTS, SeparateFilesSource } from './components/SeparateFilesSource';
import styles from './styles.module.scss';

const EMPTY_MANUAL_MANIFEST: ManualManifestT = { version: '', synonym_links: '', antonym_links: '' };

const { Text } = Typography;

type ImportDictionarySectionP = {
  // dataset version of the last successful import, from the settings store
  yourVersion?: string | undefined;
  // dataset version from the published manifest, fetched server-side;
  // undefined when the dataset has no manifest yet
  latestVersion?: string | undefined;
};

export const ImportDictionarySection: React.FC<ImportDictionarySectionP> = ({
  yourVersion,
  latestVersion: latestVersionProp,
}) => {
  const [percents, setPercents] = React.useState<number>(0);
  const [status, setStatus] = React.useState<ImportStatusE>(ImportStatusE.idle);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [installedVersion, setInstalledVersion] = React.useState<string | undefined>(yourVersion);
  const [latestVersion, setLatestVersion] = React.useState<string | undefined>(latestVersionProp);
  // where the next import reads from (issue #269): the published dataset, an
  // archive (uploaded or picked on the server) or the dataset files in slots
  const [sourceTab, setSourceTab] = React.useState<ImportSourceTabE>(ImportSourceTabE.huggingface);
  const [archive, setArchive] = React.useState<File | null>(null);
  const [serverFiles, setServerFiles] = React.useState<ImportSourceFileT[]>([]);
  const [importDirConfigured, setImportDirConfigured] = React.useState(false);
  const [serverPath, setServerPath] = React.useState<string | undefined>(undefined);
  const [slotFiles, setSlotFiles] = React.useState<SlotFilesT>({});
  const [manifestMode, setManifestMode] = React.useState<ManifestModeE>(ManifestModeE.file);
  const [manualManifest, setManualManifest] = React.useState<ManualManifestT>(EMPTY_MANUAL_MANIFEST);
  const t = useTranslations('import_dictionary');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const inProgress = status === ImportStatusE.in_progress;
  // the server runs one import at a time (issue #268): while the automatic
  // load on first start or an import from another session holds the slot,
  // the start button waits — the banner above says what is running
  const slot = useImportStatus();
  const lockedByOther = !inProgress && !!slot?.running;
  const fromHuggingFace = sourceTab === ImportSourceTabE.huggingface;
  const isUpToDate =
    fromHuggingFace && !!installedVersion && !!latestVersion && installedVersion === latestVersion;
  // nothing chosen disables the start: an archive (uploaded or picked on the
  // server) on the archive tab, at least one jsonl slot on the files tab
  const canStart =
    fromHuggingFace ||
    (sourceTab === ImportSourceTabE.archive && (!!archive || !!serverPath)) ||
    (sourceTab === ImportSourceTabE.files && JSONL_SLOTS.some((slot) => !!slotFiles[slot]));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await EnApi.getImportSources();
      if (cancelled || 'error' in res) return;
      setImportDirConfigured(res.import_dir_configured);
      setServerFiles(res.files);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    const runImport = () => {
      if (sourceTab === ImportSourceTabE.files) {
        // a manifest typed by hand replaces the manifest slot
        const { manifest: _manifest, ...jsonl } = slotFiles;
        const manual = manifestMode === ManifestModeE.manual;
        return EnApi.uploadDictionary(
          manual ? jsonl : slotFiles,
          manual
            ? {
                version: manualManifest.version.trim() || undefined,
                synonym_links:
                  manualManifest.synonym_links === '' ? undefined : Number(manualManifest.synonym_links),
                antonym_links:
                  manualManifest.antonym_links === '' ? undefined : Number(manualManifest.antonym_links),
              }
            : {},
          handleChunk,
          onError,
        );
      }
      if (sourceTab === ImportSourceTabE.archive && archive) {
        return EnApi.uploadDictionary({ archive }, {}, handleChunk, onError);
      }
      return EnApi.importDictionary(
        sourceTab === ImportSourceTabE.archive && serverPath
          ? { source: { kind: ImportSourceKindE.file, path: serverPath } }
          : {},
        handleChunk,
        onError,
      );
    };
    const res = await runImport();
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
      <Tabs
        activeKey={sourceTab}
        onChange={(key) => !inProgress && setSourceTab(key as ImportSourceTabE)}
        items={[
          {
            key: ImportSourceTabE.huggingface,
            label: t('source_huggingface'),
            children: (
              <Text strong>
                {t('latest_version')}: {latestVersion || '—'}
              </Text>
            ),
          },
          {
            key: ImportSourceTabE.archive,
            label: t('source_archive'),
            children: (
              <ArchiveSource
                archive={archive}
                onArchiveChange={setArchive}
                importDirConfigured={importDirConfigured}
                serverFiles={serverFiles}
                serverPath={serverPath}
                onServerPathChange={setServerPath}
                disabled={inProgress}
              />
            ),
          },
          {
            key: ImportSourceTabE.files,
            label: t('source_files'),
            children: (
              <SeparateFilesSource
                files={slotFiles}
                onFilesChange={setSlotFiles}
                manifestMode={manifestMode}
                onManifestModeChange={setManifestMode}
                manual={manualManifest}
                onManualChange={setManualManifest}
                disabled={inProgress}
              />
            ),
          },
        ]}
      />
      <Text strong>
        {t('your_version')}: {installedVersion || '—'}
      </Text>
      <Progress
        className={styles.progress}
        percent={percents}
        status={progressStatus}
        format={(p = 0) => `${p.toFixed(2)}%`}
      />
      {isUpToDate && !inProgress && <Text type="success">{t('up_to_date')}</Text>}
      {(status === ImportStatusE.idle || status === ImportStatusE.error) && (
        // an up-to-date dictionary demotes the button but keeps re-import possible
        <Button
          type={isUpToDate ? 'default' : 'primary'}
          onClick={importDictionary}
          disabled={!canStart || lockedByOther}
          className={styles.startBtn}
        >
          {status === ImportStatusE.error ? t('retry_importing') : t('start_importing')}
        </Button>
      )}
      {lockedByOther && <Text type="warning">{t('import_locked')}</Text>}
      {inProgress && statusMessage && <Text italic>{statusMessage}</Text>}
      {status !== ImportStatusE.idle && (
        <Text type="secondary">
          {t('elapsed_time')}: {formatTime(elapsedSeconds)}
        </Text>
      )}
    </div>
  );
};
