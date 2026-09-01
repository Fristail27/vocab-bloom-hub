'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { DictionarySwitcher } from '@/components/DictionarySwitcher';
import { Icon } from '@/core/ui/Icon';
import { IconNamesT } from '@/core/ui/icons/types';
import styles from './styles.module.scss';

const { Title } = Typography;

// path segment under /[locale]; '' is the dashboard
const MENU_ITEMS = [
  '',
  'managing',
  'statistics',
  'suggestions',
  'history',
  'settings',
  'documentation',
] as const;
const MENU_KEYS: Record<string, string> = { '': 'main' };
const MENU_ICONS: Partial<Record<string, IconNamesT>> = { '': 'home', managing: 'managing' };

export const SideMenu = () => {
  const t = useTranslations('menu');
  const { locale } = useParams();
  const pathname = usePathname();

  // client-side navigation (issue #348): antd links reloaded the document,
  // re-running the whole RSC layout (checkToken + getSettings) per click
  const isCurrent = (href: string) =>
    href === `/${locale}/` ? pathname === href || pathname === `/${locale}` : pathname.startsWith(href);

  return (
    <div className={styles.sideMenu}>
      <div className={styles.menuContent}>
        <div className={styles.topPart}>
          <Title level={4}>{t('menu_title')}</Title>
          <nav aria-label={t('menu_title')} className={styles.menuItems}>
            {MENU_ITEMS.map((item) => {
              const href = `/${locale}/${item}`;
              const icon = MENU_ICONS[item];
              return (
                <Link
                  key={item}
                  className={styles.linkItem}
                  href={href}
                  aria-current={isCurrent(href) ? 'page' : undefined}
                >
                  {icon && <Icon name={icon} color="var(--ant-color-link)" />}
                  {t(MENU_KEYS[item] ?? item)}
                </Link>
              );
            })}
          </nav>
        </div>
        <DictionarySwitcher />
      </div>
    </div>
  );
};
