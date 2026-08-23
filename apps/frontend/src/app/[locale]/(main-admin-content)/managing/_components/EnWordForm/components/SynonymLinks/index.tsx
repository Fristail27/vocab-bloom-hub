import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Tag } from 'antd';
import styles from './styles.module.scss';

type SynonymLinksP = {
  synonyms: string[];
};

// Every synonym is a dictionary word: link it to the search page so a reader
// can jump between senses
export const SynonymLinks: React.FC<SynonymLinksP> = ({ synonyms }) => {
  const locale = useLocale();

  if (synonyms.length === 0) {
    return null;
  }

  return (
    <div className={styles.synonymLinks}>
      {synonyms.map((synonym) => (
        <Link key={synonym} href={`/${locale}/managing?search=${encodeURIComponent(synonym)}`}>
          <Tag className={styles.tag} color="purple" variant="outlined">
            {synonym}
          </Tag>
        </Link>
      ))}
    </div>
  );
};
