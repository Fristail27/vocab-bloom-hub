import React from 'react';
import { Button, Typography } from 'antd';
import { CloseOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { optionRender } from '@/core/ui/Select/utils';
import { AreaVariantsOptions } from './constants';
import { EnAreaVariantsE } from 'server/types';
import { FormWordT } from '../../constants';
import styles from './styles.module.scss';

const { Text } = Typography;

type FormsOfWordLineP = {
  values: FormWordT[];
  disabled?: boolean | undefined;
  onChange: (v: FormWordT, i: number) => void;
  addField: () => void;
  deleteField: (id: number) => void;
  title: string;
};

export const FormsOfWordLine: React.FC<FormsOfWordLineP> = ({
  values,
  disabled,
  onChange,
  addField,
  title,
  deleteField,
}) => {
  return (
    <div className={styles.inputsAndButton}>
      <Text strong>{title}</Text>
      {values.map((w, i) => (
        <div key={i}>
          <div className={styles.firstLine}>
            <Input
              onChange={(e) => onChange({ ...w, word: e.target.value }, i)}
              value={w.word}
              disabled={disabled}
            />
            <Button onClick={() => deleteField(w.id)} type="text">
              <CloseOutlined />
            </Button>
          </div>
          <div className={styles.firstLine}>
            <Input
              onChange={(e) => onChange({ ...w, transcription: e.target.value }, i)}
              value={w.transcription}
              disabled={disabled}
              placeholder="Транскрипция"
            />
            <Select
              className={styles.select}
              value={w.area_variant}
              onChange={(v) => onChange({ ...w, area_variant: v as EnAreaVariantsE }, i)}
              options={AreaVariantsOptions}
              optionRender={optionRender}
            />
          </div>
        </div>
      ))}
      <Button onClick={addField} type="primary">
        <PlusCircleOutlined />
      </Button>
    </div>
  );
};
