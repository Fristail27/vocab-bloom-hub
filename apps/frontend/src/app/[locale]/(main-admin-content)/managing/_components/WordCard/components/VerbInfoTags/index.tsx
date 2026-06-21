import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EditOutlined } from '@ant-design/icons';
import { App, Button, Tag, Typography } from 'antd';
import { EnWordT } from 'server/types';
import { WordCardModeE } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/constants';
import { AddOrEditPhrasalModal } from '../AddOrEditPhrasalModal';
import { PhrasalModalMoteE } from '../AddOrEditPhrasalModal/constants';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordCardP = {
  word: Omit<EnWordT, 'word'> & { word: string };
  mode: WordCardModeE | undefined;
  updatePhrasal: (w: string | null) => void;
};

export const VerbInfoTags: React.FC<WordCardP> = ({ word, mode, updatePhrasal }) => {
  const [isOpenPhrasal, setIsOpenPhrasal] = useState<boolean>(false);
  const [phrasalMode, setPhrasalMode] = useState<PhrasalModalMoteE>(PhrasalModalMoteE.add);

  const { message } = App.useApp();
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');

  const onClick = (m: PhrasalModalMoteE) => {
    setPhrasalMode(m);
    setIsOpenPhrasal(true);
  };

  const submitPhrasalBase = async (id: number, w: string) => {
    const res = await EnApi.editPhrasalBase({ phrasal_base_id: id, id: word.id });
    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      setIsOpenPhrasal(false);
      updatePhrasal(w);
    }
  };

  return (
    <>
      <AddOrEditPhrasalModal
        mode={phrasalMode}
        isOpen={isOpenPhrasal}
        onClose={() => setIsOpenPhrasal(false)}
        submit={submitPhrasalBase}
      />
      <div className={styles.verbTags}>
        <div className={styles.line}>
          {word.verb___transitivity && (
            <Tag className={styles.tag} color="orange" variant="outlined">
              <Text>{t('verb_transitivity')}:</Text>
              {word.verb___transitivity}
            </Tag>
          )}
          {word.verb___is_irregular && (
            <Tag className={styles.tag} color="green" variant="outlined">
              {t('verb_is_irregular')}
            </Tag>
          )}
        </div>

        {word.verb___is_phrasal && (
          <div className={styles.line}>
            <Tag color="geekblue" variant="outlined">
              {t('verb_is_phrasal')}
            </Tag>
            {!word.base_phrasal && (
              <Button
                className={styles.editBtn}
                type="primary"
                size="small"
                onClick={() => onClick(PhrasalModalMoteE.add)}
              >
                <EditOutlined />
                {t('add_phrasal_base')}
              </Button>
            )}
            {word.base_phrasal && (
              <Tag className={styles.tag} color="orange" variant="outlined">
                <Text>{t('phrasal_base')}:</Text>
                {word.base_phrasal}
                {mode === WordCardModeE.edit && (
                  <Button
                    className={styles.editBtn}
                    type="primary"
                    size="small"
                    onClick={() => onClick(PhrasalModalMoteE.edit)}
                  >
                    <EditOutlined />
                  </Button>
                )}
              </Tag>
            )}
            {word.verb___phrasal_object_pattern && (
              <Tag className={styles.tag} color="cyan" variant="outlined">
                <Text>{t('verb_phrasal_object_pattern')}:</Text>
                {word.verb___phrasal_object_pattern}
              </Tag>
            )}
          </div>
        )}
      </div>
    </>
  );
};
