'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from 'antd';
import { EnPartOfSpeechE, EnWordT } from 'server/types';
import {
  CommonInfoFields,
  CommonInfoFieldsValueT,
} from '@/app/[locale]/(main-admin-content)/managing/_components/CommonInfoFields';
import { getDefaultValue } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/EditCommonDataModal/utils';
import styles from './styles.module.scss';

type EditCommonDataModalP = {
  isOpen: boolean;
  onClose: () => void;
  submit: (values: CommonInfoFieldsValueT) => void;
  data: EnWordT;
  pos: EnPartOfSpeechE;
};

export const EditCommonDataModal: React.FC<EditCommonDataModalP> = ({ isOpen, onClose, submit, data, pos }) => {
  const [d, setD] = useState<CommonInfoFieldsValueT>(getDefaultValue(data));
  const t = useTranslations('en_managing_words');

  return (
    <Modal open={isOpen} title={t('edit_common_data')} onCancel={onClose} onOk={() => submit(d)}>
      <div className={styles.fields}>
        <CommonInfoFields pos={pos} value={d} onChange={setD} />
      </div>
    </Modal>
  );
};
