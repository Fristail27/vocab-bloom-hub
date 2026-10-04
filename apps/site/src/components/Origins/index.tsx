import { useTranslations } from 'next-intl';
import type { OriginT } from 'server/types';
import styles from './styles.module.scss';

/** Runs on the server and in the lazily fetched dataset panels. */
export const Origins = ({
  origins,
  contribution = false,
  title,
}: {
  origins?: OriginT[] | null;
  contribution?: boolean;
  title?: string;
}) => {
  const t = useTranslations('provenance');
  if (!origins?.length) return null;
  return (
    <section className={styles.sources} aria-label={title ?? t(contribution ? 'contributions' : 'sources')}>
      {(title || contribution) && <h3 className={styles.title}>{title ?? t('contributions')}</h3>}
      {origins.map((origin) => (
        <details key={origin.id}>
          <summary>
            {contribution ? t('edited_in', { name: origin.name }) : origin.name} ·{' '}
            {origin.version ?? t('unknown_version')}
            {contribution && (
              <span className={styles.licenses}>
                {' '}
                · {origin.licenses.map((license) => license.spdx ?? license.name).join(', ')}
              </span>
            )}
          </summary>
          <div className={styles.content}>
            {contribution ? <p>{t('contribution_terms')}</p> : origin.inherited && <p>{t('inherited')}</p>}
            {origin.acquisitions?.map((event) => (
              <div key={event.id}>
                <p>
                  {t(event.method, {
                    name: (event.via ?? origin).name,
                    version: (event.via ?? origin).version ?? t('unknown_version'),
                  })}
                </p>
                {event.via?.url && (
                  <p>
                    <a href={event.via.url} target="_blank" rel="noreferrer noopener">
                      {t('source_link')}
                    </a>
                  </p>
                )}
                {event.recorded_at && (
                  <time dateTime={event.recorded_at}>{event.recorded_at.slice(0, 10)}</time>
                )}
              </div>
            ))}
            {origin.recorded_at && <time dateTime={origin.recorded_at}>{origin.recorded_at.slice(0, 10)}</time>}
            <p>{origin.attribution}</p>
            {origin.url && (
              <p>
                <a href={origin.url} rel="noreferrer noopener" target="_blank">
                  {t('source_link')}
                </a>
              </p>
            )}
            {origin.record_url && (
              <p>
                <a href={origin.record_url} rel="noreferrer noopener" target="_blank">
                  {t('record_link')}
                </a>
              </p>
            )}
            <p>{t(origin.license_relation === 'any' ? 'any' : 'all')}</p>
            <ul>
              {origin.licenses.map((license, index) => (
                <li key={index}>
                  <a href={license.url} rel="license noreferrer noopener" target="_blank">
                    {license.spdx ?? license.name}
                  </a>
                  {license.text && (
                    <details>
                      <summary>{t('license_text')}</summary>
                      <p>{license.text}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {origin.scope === 'dataset' && <p>{t('undetailed')}</p>}
            {origin.method === 'manual' && <p>{t('manual')}</p>}
            {origin.notices.map((notice, index) => (
              <p key={index}>{notice}</p>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
};
