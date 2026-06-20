import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { EnMeaningT } from 'server/types';
import { MeaningPreview } from './components/MeaningPreview';
import { UpdateTypeE, WordCardModeE } from '../../constants';
import { DefaultMeaningData } from './constants';
import { AddOrEditMeaningModal } from './components/AddOrEditMeaningModal';
import styles from './styles.module.scss';

const { Text } = Typography;

type MeaningsPreviewP = {
  meanings: EnMeaningT[];
  mode: WordCardModeE;
  updateMeaning: (v: EnMeaningT, type: UpdateTypeE) => void;
};

export const MeaningsPreview: React.FC<MeaningsPreviewP> = ({ meanings, mode, updateMeaning }) => {
  const [modalData, setModalData] = useState<EnMeaningT | null>(null);
  const t = useTranslations('en_managing_words');

  return (
    <>
      <AddOrEditMeaningModal
        updateMeaning={updateMeaning}
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
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
            <MeaningPreview
              meaning={meaning}
              key={meaning.id}
              mode={mode}
              setEditData={setModalData}
              updateMeaning={updateMeaning}
            />
          ))}
        </div>
      </div>
    </>
  );
};
