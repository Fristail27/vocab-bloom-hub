'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { DictionarySwitcher } from '@/components/DictionarySwitcher';
import { Icon } from '@/core/ui/Icon';
import styles from './styles.module.scss';

const { Title, Link } = Typography;

export const SideMenu = () => {
  const t = useTranslations('menu');
  const { locale } = useParams();
  return (
    <div className={styles.sideMenu}>
      <div className={styles.menuContent}>
        <div className={styles.topPart}>
          <Title level={4}>{t('menu_title')}</Title>
          <div className={styles.menuItems}>
            <Link className={styles.linkItem} href={`/${locale}/`}>
              <Icon name="home" color="var(--ant-color-link)" /> {t('main')}
            </Link>
            <Link className={styles.linkItem} href={`/${locale}/managing`}>
              <Icon name="managing" color="var(--ant-color-link)" />
              {t('managing')}
            </Link>
            <Link href={`/${locale}/statistics`}>{t('statistics')}</Link>
          </div>
        </div>
        <DictionarySwitcher />
      </div>
    </div>
  );
};
