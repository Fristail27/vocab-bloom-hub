import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { EnMeaningT } from 'server/types';
import { MeaningPreview } from './components/MeaningPreview';
import { WordCardModeE } from '../../constants';
import { DefaultMeaningData } from './constants';
import styles from './styles.module.scss';
import { AddOrEditMeaningModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview/components/AddOrEditMeaningModal';

const { Text } = Typography;

type MeaningsPreviewP = {
  meanings: EnMeaningT[];
  mode: WordCardModeE;
};

export const MeaningsPreview: React.FC<MeaningsPreviewP> = ({ meanings, mode }) => {
  const [modalData, setModalData] = useState<EnMeaningT | null>(null);
  const t = useTranslations('en_managing_words');

  return (
    <>
      <AddOrEditMeaningModal isOpen={!!modalData} onClose={() => setModalData(null)} data={modalData} />
      <div className={styles.meaningsPreview}>
        <div className={styles.title}>
          <Text strong>{t('word_meanings')}</Text>
          {mode === WordCardModeE.edit && (
            <Button
              className={styles.addBtn}
              size="small"
              type="primary"
              onClick={() => setModalData(DefaultMeaningData)}
            >
              <PlusOutlined />
            </Button>
          )}
        </div>
        <div className={styles.meanings}>
          {meanings.map((meaning: EnMeaningT) => (
            <MeaningPreview meaning={meaning} key={meaning.id} mode={mode} setEditData={setModalData} />
          ))}
        </div>
      </div>
    </>
  );
};
