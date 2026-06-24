import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Input as AntdInput, Typography } from 'antd';
import { Input } from '@/core/ui/Input';
import { CategoryE, EnAreaVariantsE, EnPartOfSpeechE, EnVerbTransitivityE, WordLevelE } from 'server/types';
import { CheckingBasePhrasalVerb } from '../CheckingBasePhrasalVerb';
import { RegionalLabelSelect } from '../RegionalLabelSelect';
import { CommonInfoDataT } from '../../types';
import { LanguageRegisterSelect } from '../LanguageRegisterSelect';
import { WordLevelSelect } from '../WordLevelSelect';
import { CategorySelect } from '../CategoriesSelect';
import { VerbTransitivitySelect } from '../VerbTransitivitySelect';
import { PhrasalObjectPatternSelect } from '../PhrasalObjectPatternSelect';
import styles from './styles.module.scss';
import { PatternEditor } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/PatternEditor';

const { TextArea } = AntdInput;
const { Text } = Typography;

type CommonWordInfoP = {
  pos: EnPartOfSpeechE;
  commonInfo: CommonInfoDataT;
  onChange: (v: CommonInfoDataT) => void;
  clickNext: () => void;
};

export const CommonWordInfo: React.FC<CommonWordInfoP> = ({ pos, clickNext, commonInfo, onChange }) => {
  const t = useTranslations('en_managing_words');

  const changeField = (v: boolean | string | CategoryE[] | string[], field: keyof CommonInfoDataT) => {
    onChange({ ...commonInfo, [field]: v });
  };

  useEffect(() => {
    if (!commonInfo.verb___is_phrasal) changeField('', 'base_phrasal');
  }, [commonInfo.verb___is_phrasal]);

  return (
    <div className={styles.commonWordInfo}>
      <div className={styles.line}>
        <Checkbox
          checked={!!commonInfo.is_obsolete}
          onChange={(e) => changeField(e.target.checked, 'is_obsolete')}
        >
          {t('is_obsolete')}
        </Checkbox>
        <Checkbox checked={commonInfo.generated} onChange={(e) => changeField(e.target.checked, 'generated')}>
          {t('is_ai_generated')}
        </Checkbox>
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!commonInfo.is_abbreviation}
            onChange={(e) => changeField(e.target.checked, 'is_abbreviation')}
          >
            {t('is_abbreviation')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!commonInfo.noun___is_proper}
            onChange={(e) => changeField(e.target.checked, 'noun___is_proper')}
          >
            {t('is_proper_noun')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!commonInfo.noun___uncountable}
            onChange={(e) => changeField(e.target.checked, 'noun___uncountable')}
          >
            {t('is_uncountable')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!commonInfo.noun___irregular_plural}
            onChange={(e) => changeField(e.target.checked, 'noun___irregular_plural')}
          >
            {t('has_irregular_plural')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!commonInfo.noun___always_plural}
            onChange={(e) => changeField(e.target.checked, 'noun___always_plural')}
          >
            {t('is_plural_only')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.verb && (
          <Checkbox
            checked={!!commonInfo.verb___is_irregular}
            onChange={(e) => changeField(e.target.checked, 'verb___is_irregular')}
          >
            {t('verb_is_irregular')}
          </Checkbox>
        )}
      </div>
      <div className={styles.line}>
        <LanguageRegisterSelect
          onChange={(v) => changeField(v, 'language_register')}
          value={commonInfo.language_register}
        />
        <WordLevelSelect
          value={commonInfo.word_level as WordLevelE}
          onChange={(v) => changeField(v as WordLevelE, 'word_level')}
        />
        <RegionalLabelSelect
          value={commonInfo.area_variant}
          onChange={(v) => changeField(v as EnAreaVariantsE, 'area_variant')}
        />
        <CategorySelect
          value={commonInfo.categories as CategoryE[]}
          onChange={(v) => changeField(v as CategoryE[], 'categories')}
        />
      </div>
      <div className={styles.line}>
        {commonInfo.generated && (
          <Input
            style={{ width: 240 }}
            label={t('source_model')}
            placeholder={t('source_model')}
            value={commonInfo.generated_by_model || ''}
            onChange={(e) => changeField(e.target.value, 'generated_by_model')}
          />
        )}
        <Input
          style={{ width: 240 }}
          label={t('pronunciation')}
          placeholder={t('pronunciation')}
          value={commonInfo.transcription || ''}
          onChange={(e) => changeField(e.target.value, 'transcription')}
        />
        {pos === EnPartOfSpeechE.verb && (
          <VerbTransitivitySelect
            onChange={(v) => changeField(v as EnVerbTransitivityE, 'verb___transitivity')}
            value={commonInfo.verb___transitivity}
          />
        )}
      </div>
      <div>
        <Text strong>{t('description')}</Text>
        <TextArea
          rows={6}
          value={commonInfo.description || ''}
          onChange={(e) => changeField(e.target.value, 'description')}
          placeholder={t('description')}
        />
      </div>
      {pos === EnPartOfSpeechE.verb && (
        <Checkbox
          checked={!!commonInfo.verb___is_phrasal}
          onChange={(e) => changeField(e.target.checked, 'verb___is_phrasal')}
        >
          <Text strong>{t('verb_is_phrasal')}</Text>
        </Checkbox>
      )}
      {pos === EnPartOfSpeechE.verb && commonInfo.verb___is_phrasal && (
        <PhrasalObjectPatternSelect
          onChange={(v) => changeField(v, 'verb___phrasal_object_pattern')}
          value={commonInfo.verb___phrasal_object_pattern}
        />
      )}
      {pos === EnPartOfSpeechE.verb && commonInfo.verb___is_phrasal && (
        <CheckingBasePhrasalVerb
          value={commonInfo.base_phrasal}
          onChange={(v) => changeField(v, 'base_phrasal')}
        />
      )}
      {pos === EnPartOfSpeechE.grammar_pattern && (
        <PatternEditor value={commonInfo.pattern || []} onChange={(v) => changeField(v, 'pattern')} />
      )}
      <Button onClick={clickNext} className={styles.btn} type="primary">
        Далее
      </Button>
    </div>
  );
};
