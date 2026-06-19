'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input as AntdInput, Modal, Typography } from 'antd';
import { CategoryE, EnPartOfSpeechE, EnWordT, WordLevelE } from 'server/types';
import { LanguageRegisterSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/LanguageRegisterSelect';
import { WordLevelSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/WordLevelSelect';
import { RegionalLabelSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/RegionalLabelSelect';
import { CategorySelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/CategoriesSelect';
import { Input } from '@/core/ui/Input';
import { VerbTransitivitySelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/VerbTransitivitySelect';
import { PhrasalObjectPatternSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/PhrasalObjectPatternSelect';
import { CommonInfoDataT } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/types';
import { getDefaultValue } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/EditCommonDataModal/utils';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type EditCommonDataModalP = {
  isOpen: boolean;
  onClose: () => void;
  submit: (values: Omit<CommonInfoDataT, 'id' | 'form_of_word' | 'base_phrasal'>) => void;
  data: EnWordT;
  pos: EnPartOfSpeechE;
};
export const EditCommonDataModal: React.FC<EditCommonDataModalP> = ({ isOpen, onClose, submit, data, pos }) => {
  const [d, setD] = useState<Omit<CommonInfoDataT, 'id' | 'form_of_word' | 'base_phrasal'>>(
    getDefaultValue(data),
  );
  const t = useTranslations('en_managing_words');

  return (
    <Modal open={isOpen} title={t('edit_common_data')} onCancel={onClose} onOk={() => submit(d)}>
      <div className={styles.line}>
        <Checkbox checked={!!d.is_obsolete} onChange={(e) => setD({ ...d, is_obsolete: e.target.checked })}>
          {t('is_obsolete')}
        </Checkbox>
        <Checkbox checked={d.generated} onChange={(e) => setD({ ...d, generated: e.target.checked })}>
          {t('is_ai_generated')}
        </Checkbox>
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!d.is_abbreviation}
            onChange={(e) => setD({ ...d, is_abbreviation: e.target.checked })}
          >
            {t('is_abbreviation')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!d.noun___is_proper}
            onChange={(e) => setD({ ...d, noun___is_proper: e.target.checked })}
          >
            {t('is_proper_noun')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!d.noun___uncountable}
            onChange={(e) => setD({ ...d, noun___uncountable: e.target.checked })}
          >
            {t('is_uncountable')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!d.noun___irregular_plural}
            onChange={(e) => setD({ ...d, noun___irregular_plural: e.target.checked })}
          >
            {t('has_irregular_plural')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.noun && (
          <Checkbox
            checked={!!d.noun___always_plural}
            onChange={(e) => setD({ ...d, noun___always_plural: e.target.checked })}
          >
            {t('is_plural_only')}
          </Checkbox>
        )}
        {pos === EnPartOfSpeechE.verb && (
          <Checkbox
            checked={!!d.verb___is_irregular}
            onChange={(e) => setD({ ...d, verb___is_irregular: e.target.checked })}
          >
            {t('verb_is_irregular')}
          </Checkbox>
        )}
      </div>
      <div className={styles.line}>
        <LanguageRegisterSelect
          onChange={(v) => setD({ ...d, language_register: v })}
          value={d.language_register}
        />
        <WordLevelSelect value={d.word_level as WordLevelE} onChange={(v) => setD({ ...d, word_level: v })} />
        <RegionalLabelSelect value={d.area_variant} onChange={(v) => setD({ ...d, area_variant: v })} />
        <CategorySelect value={d.categories as CategoryE[]} onChange={(v) => setD({ ...d, categories: v })} />
      </div>
      <div className={styles.line}>
        {d.generated && (
          <Input
            style={{ width: 240 }}
            label={t('source_model')}
            placeholder={t('source_model')}
            value={d.generated_by_model || ''}
            onChange={(e) => setD({ ...d, generated_by_model: e.currentTarget.value })}
          />
        )}
        <Input
          style={{ width: 240 }}
          label={t('pronunciation')}
          placeholder={t('pronunciation')}
          value={d.transcription || ''}
          onChange={(e) => setD({ ...d, transcription: e.currentTarget.value })}
        />
        {pos === EnPartOfSpeechE.verb && (
          <VerbTransitivitySelect
            onChange={(v) => setD({ ...d, verb___transitivity: v })}
            value={d.verb___transitivity}
          />
        )}
      </div>
      <div>
        <Text strong>{t('description')}</Text>
        <TextArea
          rows={6}
          value={d.description || ''}
          onChange={(e) => setD({ ...d, description: e.currentTarget.value })}
          placeholder={t('description')}
        />
      </div>
      {pos === EnPartOfSpeechE.verb && (
        <Checkbox
          checked={!!d.verb___is_phrasal}
          onChange={(e) => setD({ ...d, verb___is_phrasal: e.target.checked })}
        >
          <Text strong>{t('verb_is_phrasal')}</Text>
        </Checkbox>
      )}
      {pos === EnPartOfSpeechE.verb && d.verb___is_phrasal && (
        <PhrasalObjectPatternSelect
          onChange={(v) => setD({ ...d, verb___phrasal_object_pattern: v })}
          value={d.verb___phrasal_object_pattern}
        />
      )}
    </Modal>
  );
};
