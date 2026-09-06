'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App, Button, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { DictionarySwitcher } from '@/components/DictionarySwitcher';
import { AuthApi } from '@/core/api/AuthApi';
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
  const tErr = useTranslations('errors');
  const { locale } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const [loggingOut, setLoggingOut] = React.useState(false);

  // the token lives in an httpOnly cookie only the server can drop (issue #398)
  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await AuthApi.logout();
      // a failed request still ends the session on this side: the login page
      // asks for credentials again either way
      if ('error' in res) message.error(tErr(res.message));
      router.push(`/${String(locale)}/login`);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

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
        <div className={styles.bottomPart}>
          <DictionarySwitcher />
          <Button icon={<LogoutOutlined />} onClick={() => void onLogout()} loading={loggingOut} block>
            {t('logout')}
          </Button>
        </div>
      </div>
    </div>
  );
};
