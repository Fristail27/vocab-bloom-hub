import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { EnPartOfSpeechE } from 'server/types';
import { CheckingBasePhrasalVerb } from '../CheckingBasePhrasalVerb';
import { CommonInfoDataT } from '../../types';
import { CommonInfoFields } from '../../../CommonInfoFields';
import styles from './styles.module.scss';

type CommonWordInfoP = {
  pos: EnPartOfSpeechE;
  commonInfo: CommonInfoDataT;
  onChange: (v: CommonInfoDataT) => void;
  clickNext: () => void;
};

export const CommonWordInfo: React.FC<CommonWordInfoP> = ({ pos, clickNext, commonInfo, onChange }) => {
  const t = useTranslations('en_managing_words');

  useEffect(() => {
    if (!commonInfo.verb___is_phrasal) onChange({ ...commonInfo, base_phrasal: '' });
  }, [commonInfo.verb___is_phrasal]);

  return (
    <div className={styles.commonWordInfo}>
      <CommonInfoFields pos={pos} value={commonInfo} onChange={(v) => onChange({ ...commonInfo, ...v })} />
      {pos === EnPartOfSpeechE.verb && commonInfo.verb___is_phrasal && (
        <CheckingBasePhrasalVerb
          value={commonInfo.base_phrasal}
          onChange={(v) => onChange({ ...commonInfo, base_phrasal: v })}
        />
      )}
      <Button onClick={clickNext} className={styles.btn} type="primary">
        {t('next_step')}
      </Button>
    </div>
  );
};
