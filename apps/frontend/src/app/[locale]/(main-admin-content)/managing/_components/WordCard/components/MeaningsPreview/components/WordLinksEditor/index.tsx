import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App, Button, Typography } from 'antd';
import { CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { EnMeaningT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { UpdateTypeE, WordCardModeE } from '../../../../constants';
import {
  WordLinkKindT,
  WordLinks,
} from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/WordLinks';
import { WordLinksSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/WordLinksSelect';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordLinksEditorP = {
  kind: WordLinkKindT;
  meaning: EnMeaningT;
  mode: WordCardModeE;
  updateMeaning: (v: EnMeaningT, type: UpdateTypeE) => void;
  headword?: string | undefined;
};

const OTHER_KIND: Record<WordLinkKindT, WordLinkKindT> = { synonyms: 'antonyms', antonyms: 'synonyms' };

/**
 * The synonyms / antonyms line of a meaning on the word card. In edit mode
 * every tag can be unlinked with its close icon, and the plus button swaps the
 * tags for a picker over dictionary words; each change is saved right away,
 * without going through the meaning modal.
 */
export const WordLinksEditor: React.FC<WordLinksEditorP> = ({
  kind,
  meaning,
  mode,
  updateMeaning,
  headword,
}) => {
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const { message } = App.useApp();
  const editable = mode === WordCardModeE.edit;
  const words = meaning[kind] ?? [];

  const save = async (next: string[]) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await EnApi.editMeaning({ id: meaning.id, [kind]: next });
      if ('error' in res) {
        message.error(tError(res.message));
      } else {
        message.success(t('edit_meaning_success'));
        updateMeaning({ ...meaning, [kind]: next }, UpdateTypeE.edit);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wordLinksEditor}>
      <Text className={styles.title}>{t(kind)}:</Text>
      {editable && picking ? (
        <>
          <WordLinksSelect
            kind={kind}
            value={words}
            onChange={save}
            headword={headword}
            exclude={meaning[OTHER_KIND[kind]] ?? []}
            containerClassName={styles.select}
          />
          <Button size="small" type="primary" className={styles.iconBtn} onClick={() => setPicking(false)}>
            <CheckOutlined />
          </Button>
        </>
      ) : (
        <>
          <WordLinks
            kind={kind}
            words={words}
            onRemove={editable ? (word) => save(words.filter((w) => w !== word)) : undefined}
          />
          {editable && (
            <Button size="small" type="primary" className={styles.iconBtn} onClick={() => setPicking(true)}>
              <PlusOutlined />
            </Button>
          )}
        </>
      )}
    </div>
  );
};
