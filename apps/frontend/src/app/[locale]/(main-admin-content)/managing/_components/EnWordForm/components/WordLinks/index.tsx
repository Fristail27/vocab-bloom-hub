import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Tag } from 'antd';
import styles from './styles.module.scss';

export type WordLinkKindT = 'synonyms' | 'antonyms';

// One tag colour per relation so the two lists are told apart at a glance
const TAG_COLORS: Record<WordLinkKindT, string> = { synonyms: 'purple', antonyms: 'volcano' };

type WordLinksP = {
  kind: WordLinkKindT;
  words: string[];
  // When given, every tag gets a close icon that reports the word to unlink
  onRemove?: ((word: string) => void) | undefined;
};

// Every linked word (synonym or antonym) is a dictionary word: link it to the
// search page so a reader can jump between senses
export const WordLinks: React.FC<WordLinksP> = ({ kind, words, onRemove }) => {
  const locale = useLocale();

  if (words.length === 0) {
    return null;
  }

  return (
    <div className={styles.wordLinks}>
      {words.map((word) => (
        <Tag
          key={word}
          className={styles.tag}
          color={TAG_COLORS[kind]}
          variant="outlined"
          closable={!!onRemove}
          onClose={(e) => {
            // the owner drops the word from its list; antd must not hide the
            // tag on its own, or a failed request would leave a stale gap
            e.preventDefault();
            onRemove?.(word);
          }}
        >
          <Link href={`/${locale}/managing?search=${encodeURIComponent(word)}`}>{word}</Link>
        </Tag>
      ))}
    </div>
  );
};
