import React from 'react';
import { Button, Checkbox, Input as AntdInput, Radio, Typography } from 'antd';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { optionRender } from '@/core/ui/Select/utils';
import { AreaVariants, Levels } from '../../constants';
import {
  CategoryE,
  EnPartOfSpeechE,
  EnVerbTransitivityE,
  EnPhrasalObjectPatternE,
  LanguageRegisterE,
} from '../../../../../../../../../../server/types';
import { NounSettings } from '../NounSettings';
import { VerbSettings } from '../VerbSettings';
import { CommonInfoDataT } from '../../types';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type CommonWordInfoP = {
  pos: EnPartOfSpeechE;
  commonInfo: CommonInfoDataT;
  onChange: (v: CommonInfoDataT) => void;
  clickNext: () => void;
};

export const CommonWordInfo: React.FC<CommonWordInfoP> = ({ pos, clickNext, commonInfo, onChange }) => {
  const changeField = (v: boolean | string, field: keyof CommonInfoDataT) => {
    onChange({ ...commonInfo, [field]: v });
  };

  return (
    <div className={styles.commonWordInfo}>
      <Checkbox checked={commonInfo.is_obsolete} onChange={(e) => changeField(e.target.checked, 'is_obsolete')}>
        Устаревшее слово
      </Checkbox>
      <Checkbox checked={commonInfo.generated} onChange={(e) => changeField(e.target.checked, 'generated')}>
        Сгенерированное
      </Checkbox>
      <Checkbox
        checked={!!commonInfo.is_abbreviation}
        onChange={(e) => changeField(e.target.checked, 'is_abbreviation')}
      >
        Аббревиатура
      </Checkbox>
      <div>
        <Text strong>Описание слова (не значение, в основном для предлогов, союзов, служебных слов)</Text>
        <TextArea
          rows={14}
          value={commonInfo.description}
          onChange={(e) => changeField(e.target.value, 'description')}
          placeholder={commonInfo.description}
        />
      </div>
      <div className={styles.line}>
        {commonInfo.generated && (
          <Input
            label="Модель"
            placeholder="Модель"
            value={commonInfo.generatedByModel}
            onChange={(e) => changeField(e.target.value, 'generatedByModel')}
          />
        )}
        <Input
          label="Транскрипция"
          placeholder="Транскрипция"
          value={commonInfo.transcription}
          onChange={(e) => changeField(e.target.value, 'transcription')}
        />
        <Select
          className={styles.select}
          options={AreaVariants}
          optionRender={optionRender}
          value={commonInfo.area_variant}
          onChange={(value) => changeField(value as string, 'area_variant')}
          label="Маркированность"
        />
        <Select
          label="Уровень слова"
          options={Levels}
          className={styles.select}
          value={commonInfo.word_level}
          onChange={(v) => changeField(v as string, 'word_level')}
        />
      </div>
      <div className={styles.line}>
        <Select
          label="Категория"
          className={styles.select}
          value={commonInfo.category}
          onChange={(v) => changeField(v as string, 'category')}
          options={[
            { label: 'Нет', value: CategoryE.unknown },
            ...Object.values(CategoryE).map((v) => ({ label: v, value: v })),
          ]}
        />
        <div className={styles.radioContainer}>
          <Text strong>language register</Text>
          <Radio.Group
            className={styles.radio}
            onChange={(e) => changeField(e.target.value, 'language_register')}
            value={commonInfo.language_register}
          >
            <Radio value={LanguageRegisterE.formal}>formal</Radio>
            <Radio value={LanguageRegisterE.informal}>informal</Radio>
            <Radio value={LanguageRegisterE.slang}>slang</Radio>
          </Radio.Group>
        </div>
      </div>
      {pos === EnPartOfSpeechE.noun && (
        <NounSettings
          noun___countable={commonInfo.noun___countable as boolean}
          noun___is_proper={commonInfo.noun___is_proper as boolean}
          noun___irregular_plural={commonInfo.noun___irregular_plural as boolean}
          setSettings={changeField}
        />
      )}
      {pos === EnPartOfSpeechE.verb && (
        <VerbSettings
          verb___is_phrasal={commonInfo.verb___is_phrasal as boolean}
          verb___is_irregular={commonInfo.verb___is_irregular as boolean}
          verb___transitivity={commonInfo.verb___transitivity as EnVerbTransitivityE}
          setSettings={changeField}
          base_phrasal={commonInfo.base_phrasal as string}
          verb___phrasal_object_pattern={commonInfo.verb___phrasal_object_pattern as EnPhrasalObjectPatternE}
        />
      )}
      <Button onClick={clickNext} className={styles.btn} type="primary">
        Далее
      </Button>
    </div>
  );
};
