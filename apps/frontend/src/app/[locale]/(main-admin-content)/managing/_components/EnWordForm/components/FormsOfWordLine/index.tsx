import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Typography } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { EnAreaVariantsE, EnWordFormT } from 'server/types';
import { RegionalLabelSelect } from '../RegionalLabelSelect';
import { getTitle } from './utils';
import styles from './styles.module.scss';

const { Title } = Typography;

type FormsOfWordLineP = {
  values: EnWordFormT[];
  onChange: (v: EnWordFormT, i: number) => void;
  addField: () => void;
  deleteField: (id: number) => void;
  title: string;
};

export const FormsOfWordLine: React.FC<FormsOfWordLineP> = ({
  values,
  onChange,
  addField,
  title,
  deleteField,
}) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.column}>
      <span className={styles.title}>
        <Title level={4}>{getTitle(title)}</Title>
        <Button size="small" onClick={addField} type="primary">
          <PlusOutlined />
        </Button>
      </span>
      <div className={styles.formsLine}>
        {values.map((w, i) => (
          <div className={styles.formOfWordCard} key={i}>
            <Button
              size="small"
              className={styles.deleteBtn}
              onClick={() => deleteField(w.id)}
              danger
              type="primary"
            >
              <CloseOutlined />
            </Button>
            <div className={styles.firstLine}>
              <RegionalLabelSelect
                width={188}
                value={w.area_variant}
                onChange={(v) => onChange({ ...w, area_variant: v as EnAreaVariantsE }, i)}
              />
            </div>
            <Input
              label={t('form')}
              placeholder={t('form')}
              onChange={(e) => onChange({ ...w, word: e.target.value }, i)}
              value={w.word}
            />
            <Input
              onChange={(e) => onChange({ ...w, transcription: e.target.value }, i)}
              value={w.transcription || ''}
              label={t('pronunciation')}
              placeholder={t('pronunciation')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
