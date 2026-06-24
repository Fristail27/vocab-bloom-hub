'use client';

import React from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Button, Typography } from 'antd';
import { Input } from '@/core/ui/Input';
import { SlotName } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import styles from './styles.module.scss';

const { Text } = Typography;

type PatternEditorP = {
  value: string[];
  onChange: (value: string[]) => void;
};

export const PatternEditor: React.FC<PatternEditorP> = ({ value, onChange }) => {
  const t = useTranslations('en_managing_words');
  const changeHandler = (v: string, i: number) => {
    onChange(value.map((val, ind) => (ind === i ? v : val)));
  };

  const deleteHandler = (i: number) => {
    onChange(value.filter((val, ind) => ind !== i));
  };

  const addHandler = (isSlot: boolean = false) => {
    onChange([...value, isSlot ? SlotName : '']);
  };

  return (
    <div className={styles.patternEditor}>
      <Text strong>{t('pattern')}</Text>
      <div className={styles.inputs}>
        {value.map((v, i) => (
          <div key={i} className={styles.line}>
            <Input
              size="small"
              disabled={v === SlotName}
              value={v}
              onChange={(e) => changeHandler(e.target.value, i)}
            />
            <Button type="primary" danger size="small" onClick={() => deleteHandler(i)}>
              <CloseOutlined />
            </Button>
          </div>
        ))}
      </div>
      <div className={styles.buttons}>
        <Button onClick={() => addHandler()} type="primary">
          {t('add_part')}
        </Button>
        <Button onClick={() => addHandler(true)} type="primary">
          {t('add_slot')}
        </Button>
      </div>
    </div>
  );
};
