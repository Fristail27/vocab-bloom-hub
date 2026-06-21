'use client';

import React, { ChangeEventHandler, useState } from 'react';
import { App, Button } from 'antd';
import { Input } from '@/core/ui/Input';
import { WordDoesntExistBlock } from '../WordDoesntExistBlock';
import { CheckCircleOutlined } from '@ant-design/icons';
import { StatusOfWordPresenceE } from '../../types';
import { useTranslations } from 'next-intl';
import { EnPartOfSpeechE } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { BasePhrasalIcon } from './components/BasePhrasalIcon';
import { getInputStatus } from './utils';
import styles from './styles.module.scss';

type VerbSettingsP = {
  onChange: (v: string) => void;
  value: string | null | undefined;
  setCheckedId?: (v: number) => void;
};

export const CheckingBasePhrasalVerb: React.FC<VerbSettingsP> = ({ onChange, value, setCheckedId }) => {
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const { message } = App.useApp();

  const [statusOfPresence, setStatusOfPresence] = useState<StatusOfWordPresenceE>(
    StatusOfWordPresenceE.notChecked,
  );

  const onChangeHandler: ChangeEventHandler<HTMLInputElement, HTMLInputElement> = (e) => {
    setStatusOfPresence(StatusOfWordPresenceE.notChecked);
    onChange(e.target.value);
  };

  const checkPhrasalBase = async () => {
    const res = await EnApi.checkWord(value as string, EnPartOfSpeechE.verb, true);
    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      setStatusOfPresence(res.hasWord ? StatusOfWordPresenceE.present : StatusOfWordPresenceE.absent);
      if (setCheckedId && res.hasWord && res.id) {
        setCheckedId(res.id);
      }
    }
  };

  return (
    <div className={styles.checkingBasePhrasalVerb}>
      <div className={styles.checkPhrasalBase}>
        <Input
          style={{ width: 200 }}
          status={getInputStatus(statusOfPresence)}
          prefix={<BasePhrasalIcon status={statusOfPresence} />}
          label={t('phrasal_base')}
          onChange={onChangeHandler}
          value={value || ''}
        />
        <Button onClick={checkPhrasalBase} size="middle" type="primary">
          <CheckCircleOutlined />
        </Button>
      </div>
      {statusOfPresence === StatusOfWordPresenceE.absent && <WordDoesntExistBlock word={value as string} />}
    </div>
  );
};
