import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button, Result } from 'antd';
import { ErrorCodes } from 'server/core/constants/error_codes';
import { InterfaceLanguageEnum } from '@/types/common';

type StatisticsErrorP = {
  locale: InterfaceLanguageEnum;
  message: string;
};

export const StatisticsError = async ({ locale, message }: StatisticsErrorP) => {
  const tError = await getTranslations('errors');
  const statsT = await getTranslations('statistics');
  const isKnownCode = (Object.values(ErrorCodes) as string[]).includes(message);

  return (
    <Result
      status="error"
      title={tError(isKnownCode ? message : ErrorCodes.unknown_error)}
      extra={
        <Link href={`/${locale}/statistics`}>
          <Button type="primary">{statsT('back_to_statistics')}</Button>
        </Link>
      }
    />
  );
};
