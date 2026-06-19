'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { App, Button, Input as AntdInput, Modal, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { CategoryE, EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from 'server/types';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { DefaultState } from './constants';
import { AddOrEditStateT } from './types';
import { EnApi } from '@/core/api/EnApi';
import { RegionalLabelSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/RegionalLabelSelect';
import { WordLevelSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/WordLevelSelect';
import { LanguageRegisterSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/LanguageRegisterSelect';
import { CategorySelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/CategoriesSelect';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type AddOrEditMeaningModalP = {
  isOpen: boolean;
  onClose: () => void;
  data: EnMeaningT | null;
};

export const AddOrEditMeaningModal: React.FC<AddOrEditMeaningModalP> = ({ isOpen, onClose, data }) => {
  const [values, setValues] = useState<AddOrEditStateT>(DefaultState);
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const { message } = App.useApp();

  const { wordId } = useParams();

  const submitAdd = async () => {
    if (wordId) {
      const res = await EnApi.addMeaning({ word_id: +wordId, ...values });

      if ('error' in res) {
        message.error(tError(res.message));
      } else {
        message.success(t('add_meaning_success'));
        onClose();
      }
    }
  };

  const submitEdit = async () => {
    if (data) {
      const res = await EnApi.editMeaning({ id: data.id, ...values });

      if ('error' in res) {
        message.error(tError(res.message));
      } else {
        message.success(t('edit_meaning_success'));
        onClose();
      }
    }
  };

  const addExample = () => {
    setValues({ ...values, examples: [...values.examples, ''] });
  };

  const changeExample = (v: string, i: number) => {
    setValues({ ...values, examples: values.examples.map((w, ind) => (i === ind ? v : w)) });
  };

  const removeExample = (i: number) => {
    setValues({ ...values, examples: values.examples.filter((_, ind) => i !== ind) });
  };

  useEffect(() => {
    if (data) {
      setValues({
        examples: data.examples,
        definition: data.definition,
        title: data.title,
        is_obsolete: data.is_obsolete,
        area_variant: data.area_variant,
        meaning_level: data.meaning_level,
        categories: data.categories,
        language_register: data.language_register,
        sort_order: data.sort_order,
      });
    }
  }, [data]);

  return (
    <Modal
      open={isOpen}
      onOk={data?.id === 0 ? submitAdd : submitEdit}
      onCancel={onClose}
      title={data?.id === 0 ? t('add_meaning') : t('edit_meaning')}
    >
      {data && (
        <div className={styles.meaning}>
          <Input
            label={t('short_meaning')}
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
          <div className={styles.line}>
            <RegionalLabelSelect
              value={values.area_variant as EnAreaVariantsE}
              onChange={(v) => setValues({ ...values, area_variant: v as EnAreaVariantsE })}
            />
            <WordLevelSelect
              value={values.meaning_level as WordLevelE}
              onChange={(v) => setValues({ ...values, meaning_level: v as WordLevelE })}
            />
            <LanguageRegisterSelect
              onChange={(v) => setValues({ ...values, language_register: v })}
              value={values.language_register as LanguageRegisterE}
            />
          </div>
          <div className={styles.line}>
            <Input
              className={styles.sortOrder}
              size="medium"
              type="number"
              value={values.sort_order}
              onChange={(e) => setValues({ ...values, sort_order: e.currentTarget.valueAsNumber })}
            />
            <CategorySelect
              value={values.categories as CategoryE[]}
              onChange={(v) => setValues({ ...values, categories: v })}
            />
          </div>
          <div>
            <Text strong>{t('full_meaning_description')}</Text>
            <TextArea
              value={values.definition}
              onChange={(e) => setValues({ ...values, definition: e.target.value })}
            />
          </div>
          <div className={styles.examples}>
            <div className={styles.examplesTitle}>
              <Text strong>{t('examples')}</Text>
              <Button size="small" className={styles.addBtn} onClick={addExample} type="primary">
                <PlusOutlined />
              </Button>
            </div>
            {values.examples.map((example, i) => (
              <div className={styles.example} key={i.toString()}>
                <Input onChange={(e) => changeExample(e.target.value, i)} value={example} />
                <Button type="primary" danger onClick={() => removeExample(i)}>
                  <CloseOutlined />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};
