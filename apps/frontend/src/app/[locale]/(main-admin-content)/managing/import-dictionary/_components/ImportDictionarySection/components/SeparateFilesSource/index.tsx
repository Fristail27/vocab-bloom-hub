import React from 'react';
import { Button, Radio, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
  UPLOAD_FILE_FIELDS,
  UploadFileFieldT,
} from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';
import { Input } from '@/core/ui/Input';
import { ManifestModeE, ManualManifestT, SlotFilesT } from '../../types';
import styles from './styles.module.scss';

const { Text } = Typography;

// the jsonl slots in the order the import processes them; the manifest has its own row
export const JSONL_SLOTS = (Object.keys(UPLOAD_FILE_FIELDS) as UploadFileFieldT[]).filter(
  (slot) => slot !== 'manifest',
);

type SeparateFilesSourceP = {
  files: SlotFilesT;
  onFilesChange: (files: SlotFilesT) => void;
  manifestMode: ManifestModeE;
  onManifestModeChange: (mode: ManifestModeE) => void;
  manual: ManualManifestT;
  onManualChange: (manual: ManualManifestT) => void;
  disabled: boolean;
};

type SlotP = {
  slot: UploadFileFieldT;
  file: File | undefined;
  accept: string;
  onChange: (file: File | undefined) => void;
  disabled: boolean;
};

// One upload slot: the slot decides what the file is, its own name does not matter
const Slot: React.FC<SlotP> = ({ slot, file, accept, onChange, disabled }) => {
  const t = useTranslations('import_dictionary');
  return (
    <div className={styles.slot} data-testid={`slot-${slot}`}>
      <Text strong className={styles.slotLabel}>
        {t(`file_${slot}`)}
      </Text>
      <Upload
        accept={accept}
        maxCount={1}
        disabled={disabled}
        fileList={file ? [{ uid: slot, name: file.name, status: 'done' }] : []}
        beforeUpload={(picked) => {
          onChange(picked);
          return false;
        }}
        onRemove={() => onChange(undefined)}
      >
        <Button size="small" icon={<UploadOutlined />} disabled={disabled}>
          {t('choose_file')}
        </Button>
      </Upload>
    </div>
  );
};

/**
 * The "separate files" tab: one slot per dataset file (at least one jsonl
 * file is needed, the rest is optional) and the manifest either as a file or
 * typed by hand.
 */
export const SeparateFilesSource: React.FC<SeparateFilesSourceP> = ({
  files,
  onFilesChange,
  manifestMode,
  onManifestModeChange,
  manual,
  onManualChange,
  disabled,
}) => {
  const t = useTranslations('import_dictionary');
  const setSlot = (slot: UploadFileFieldT, file: File | undefined) => onFilesChange({ ...files, [slot]: file });

  return (
    <div className={styles.separateFiles}>
      <Text type="secondary">{t('files_hint')}</Text>
      {JSONL_SLOTS.map((slot) => (
        <Slot
          key={slot}
          slot={slot}
          file={files[slot]}
          accept=".jsonl,application/x-ndjson"
          onChange={(file) => setSlot(slot, file)}
          disabled={disabled}
        />
      ))}
      <div className={styles.manifest}>
        <Text strong>{t('file_manifest')}</Text>
        <Radio.Group
          size="small"
          disabled={disabled}
          value={manifestMode}
          onChange={(e) => onManifestModeChange(e.target.value as ManifestModeE)}
          options={[
            { value: ManifestModeE.file, label: t('manifest_from_file') },
            { value: ManifestModeE.manual, label: t('manifest_manual') },
          ]}
        />
        {manifestMode === ManifestModeE.file ? (
          <Slot
            slot="manifest"
            file={files.manifest}
            accept=".json,application/json"
            onChange={(file) => setSlot('manifest', file)}
            disabled={disabled}
          />
        ) : (
          <div className={styles.manualFields}>
            <Input
              size="medium"
              label={t('manifest_version')}
              aria-label={t('manifest_version')}
              value={manual.version}
              disabled={disabled}
              onChange={(e) => onManualChange({ ...manual, version: e.target.value })}
            />
            <Input
              size="medium"
              type="number"
              min={0}
              label={t('manifest_synonym_links')}
              aria-label={t('manifest_synonym_links')}
              value={manual.synonym_links}
              disabled={disabled}
              onChange={(e) => onManualChange({ ...manual, synonym_links: e.target.value })}
            />
            <Input
              size="medium"
              type="number"
              min={0}
              label={t('manifest_antonym_links')}
              aria-label={t('manifest_antonym_links')}
              value={manual.antonym_links}
              disabled={disabled}
              onChange={(e) => onManualChange({ ...manual, antonym_links: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
};
