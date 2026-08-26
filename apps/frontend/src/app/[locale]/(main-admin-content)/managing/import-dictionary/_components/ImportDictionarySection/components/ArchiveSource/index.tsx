import React from 'react';
import { Select, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ImportSourceFileT } from 'server/types';
import { formatBytes } from '@/helpers/formatBytes';
import styles from './styles.module.scss';

const { Text } = Typography;

type ArchiveSourceP = {
  archive: File | null;
  onArchiveChange: (file: File | null) => void;
  // datasets the server can read (DICTIONARY_IMPORT_DIR); an uploaded archive wins over a pick
  importDirConfigured: boolean;
  serverFiles: ImportSourceFileT[];
  serverPath: string | undefined;
  onServerPathChange: (path: string | undefined) => void;
  disabled: boolean;
};

/** The "archive" tab: one zip produced by the export, or a dataset picked on the server */
export const ArchiveSource: React.FC<ArchiveSourceP> = ({
  archive,
  onArchiveChange,
  importDirConfigured,
  serverFiles,
  serverPath,
  onServerPathChange,
  disabled,
}) => {
  const t = useTranslations('import_dictionary');

  return (
    <div className={styles.archiveSource}>
      <Upload.Dragger
        accept=".zip,application/zip"
        maxCount={1}
        disabled={disabled}
        fileList={archive ? [{ uid: 'archive', name: archive.name, status: 'done' }] : []}
        // the archive is kept in memory until the import starts, nothing is uploaded on pick
        beforeUpload={(file) => {
          onArchiveChange(file);
          return false;
        }}
        onRemove={() => onArchiveChange(null)}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t('upload_text')}</p>
        <p className="ant-upload-hint">{t('upload_hint')}</p>
      </Upload.Dragger>
      {importDirConfigured ? (
        <Select<string>
          className={styles.serverFile}
          allowClear
          disabled={disabled || !!archive}
          placeholder={t('server_file_placeholder')}
          value={serverPath}
          onChange={onServerPathChange}
          options={serverFiles.map((f) => ({
            value: f.path,
            label: f.kind === 'zip' ? `${f.path} (${formatBytes(f.size)})` : `${f.path}/`,
          }))}
          notFoundContent={<Text type="secondary">{t('server_file_empty')}</Text>}
        />
      ) : (
        <Text type="secondary">{t('import_dir_hint')}</Text>
      )}
    </div>
  );
};
