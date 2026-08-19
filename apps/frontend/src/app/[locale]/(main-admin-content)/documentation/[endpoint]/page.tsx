import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { CommonPageP } from '@/types/common';
import { getEndpointBySlug } from '../constants';
import { EndpointDoc } from '../_components/EndpointDoc';
import styles from './styles.module.scss';

export default async function EndpointDocPage({ params }: CommonPageP<{ endpoint: string }>) {
  const { locale, endpoint: slug } = await params;
  const endpoint = getEndpointBySlug(slug);

  if (!endpoint) {
    notFound();
  }

  const t = await getTranslations('menu');
  const docsT = await getTranslations('documentation');
  const title = docsT(`endpoint_${endpoint.key}`);

  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/documentation`, title: t('documentation') },
    { title },
  ];

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{title}</Title>
      <Breadcrumb items={breadCrumbs} />
      <EndpointDoc endpoint={endpoint} />
    </div>
  );
}
