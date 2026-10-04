'use client';

import React from 'react';
import { Alert, Button, Modal } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DatasetT } from 'server/types';
import { isPublicSourceDataset } from 'server/core/constants/dataset_catalog';
import styles from './styles.module.scss';

/**
 * The dataset an edit is made in (issue #531): the one the switch of the
 * header names, else the active one (issue #540), given by the page that
 * shows the word. The dialogs of the word card read it from here —
 * they open in a portal, the context reaches them all the same.
 */
export const EditedDatasetContext = React.createContext<DatasetT | undefined>(undefined);

/**
 * Whether the dataset being edited holds what people wrote: a dataset of a
 * public source carries no notice about generated text, so nothing generated
 * by a model is added to it — the forms offer no way to. The project's
 * dataset and the datasets of the instance's own take it (issue #540).
 */
export const useWrittenByPeopleOnly = (): boolean => {
  const dataset = React.useContext(EditedDatasetContext);
  return !!dataset && isPublicSourceDataset(dataset);
};

/** The provider a server page wraps its form in */
export const EditedDataset: React.FC<{ dataset: DatasetT | undefined; children: React.ReactNode }> = ({
  dataset,
  children,
}) => <EditedDatasetContext.Provider value={dataset}>{children}</EditedDatasetContext.Provider>;

/**
 * Says under which license an edit is published, before it is made: what is
 * changed in a dataset becomes a part of it, under the license of its
 * source, and readers are told that the entry was changed. Renders nothing
 * where the dataset is not known.
 */
export const EditLicenseNote: React.FC<{ confirmSource?: boolean }> = ({ confirmSource = false }) => {
  const dataset = React.useContext(EditedDatasetContext);
  const t = useTranslations('en_managing_words');
  const p = useTranslations('provenance');
  const locale = useLocale();
  const router = useRouter();
  const [warning, setWarning] = React.useState(false);
  React.useEffect(() => {
    if (confirmSource && dataset && !dataset.own)
      setWarning(sessionStorage.getItem(`edit-source:${dataset.name}`) !== 'yes');
  }, [dataset, confirmSource]);
  if (!dataset) return null;

  return (
    // a wrapper of its own: the margin of a class does not outweigh the styles of the component
    <div className={styles.note}>
      {!dataset.own && (
        <>
          <Alert
            type="warning"
            title={p('static_warning')}
            action={
              <Link href={`/${locale}/managing/datasets?fork=${encodeURIComponent(dataset.name)}`}>
                {p('fork_button')}
              </Link>
            }
          />
          <Modal
            open={warning}
            title={p('static_title')}
            onCancel={() => {
              setWarning(false);
              router.push(`/${locale}/managing/datasets`);
            }}
            footer={[
              <Button
                key="cancel"
                onClick={() => {
                  setWarning(false);
                  router.push(`/${locale}/managing/datasets`);
                }}
              >
                {p('cancel')}
              </Button>,
              <Button
                key="continue"
                onClick={() => {
                  sessionStorage.setItem(`edit-source:${dataset.name}`, 'yes');
                  setWarning(false);
                }}
              >
                {p('continue_editing')}
              </Button>,
              <Button
                key="fork"
                type="primary"
                onClick={() =>
                  router.push(`/${locale}/managing/datasets?fork=${encodeURIComponent(dataset.name)}`)
                }
              >
                {p('fork_button')}
              </Button>,
            ]}
          >
            {p('static_warning')}
          </Modal>
        </>
      )}
      {dataset.notice && <Alert type="info" title={dataset.notice} />}
      <Alert
        type="info"
        showIcon
        data-testid="edit-license-note"
        title={
          <>
            {t('editing_license', { dataset: dataset.title })}{' '}
            {dataset.license_url ? (
              <a href={dataset.license_url} target="_blank" rel="license noreferrer noopener">
                {dataset.license}
              </a>
            ) : (
              dataset.license
            )}
            . {t('editing_license_effect')}
            {isPublicSourceDataset(dataset) && <> {t('editing_no_generated')}</>}
          </>
        }
      />
    </div>
  );
};
