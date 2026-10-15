import React from 'react';
import { Alert, Progress, Space, Spin, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import type { ReconciliationPreparationT, ReconciliationApplicationT } from 'server/types/reconciliation';

export function OperationProgress({
  progress,
}: {
  progress: ReconciliationPreparationT | ReconciliationApplicationT;
}) {
  const t = useTranslations('reconciliation');
  const preparing = 'source' in progress;
  const stage = preparing ? `stage_${progress.stage}` : `application_stage_${progress.stage}`;
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(progress.started_at)) / 1000));
  return (
    <Alert
      type="info"
      title={preparing ? t('preparation_running', { source: progress.source }) : t('application_running')}
      description={
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div role="status" aria-live="polite">
            <Space>
              <Spin size="small" />
              <Typography.Text>{t(stage)}</Typography.Text>
            </Space>
            <div>
              {progress.total === undefined
                ? t('processed', { count: progress.processed })
                : t('processed_total', { count: progress.processed, total: progress.total })}
            </div>
          </div>
          {progress.total !== undefined && (
            <Progress
              aria-label={t(stage)}
              percent={progress.total ? Math.floor((progress.processed / progress.total) * 100) : 100}
              status="active"
            />
          )}
          <Typography.Text>
            {t('elapsed', { minutes: Math.floor(elapsed / 60), seconds: elapsed % 60 })}
          </Typography.Text>
          <Typography.Text>
            {t(preparing ? 'preparation_background' : 'application_background')}
          </Typography.Text>
        </Space>
      }
    />
  );
}
