'use client';

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Typography } from 'antd';
import { AuthApi } from '@/core/api/AuthApi';
import { hashLoginString } from '../../../../../../../server/core/utils/crypto';
import { StateContext } from '@/components/StateContext';
import { Input } from '@/core/ui/Input';
import styles from './styles.module.scss';

const { Text, Title } = Typography;

export const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { setIsAuth } = useContext(StateContext);
  const router = useRouter();
  const t = useTranslations('login');
  const tErr = useTranslations('errors');

  const submitLogin = async () => {
    const hash = await hashLoginString(username, pass);
    const res = await AuthApi.login({ hash });
    if ('error' in res) {
      setError(tErr(res.message));
    } else {
      setIsAuth(true);
      router.push('/');
    }
  };

  useEffect(() => {
    setError(null);
  }, [pass, username]);

  return (
    <div className={styles.card}>
      <Title level={1}>Vocab Bloom Hub</Title>
      <Title level={3}>{t('admin_panel_sign_in')}</Title>
      <div className={styles.form}>
        <Input
          style={{ width: '100%' }}
          label={t('username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          id="username"
          name="username"
          status={error ? 'error' : undefined}
          placeholder={t('username')}
        />
        <Input
          style={{ width: '100%' }}
          label={t('password')}
          value={pass}
          type="password"
          onChange={(e) => setPass(e.target.value)}
          id="password"
          name="password"
          status={error ? 'error' : undefined}
          placeholder={t('password')}
        />
        {error && <Text type="danger">{error}</Text>}
        <Button type="primary" disabled={!!error} onClick={submitLogin}>
          {t('sign_in')}
        </Button>
      </div>
    </div>
  );
};
