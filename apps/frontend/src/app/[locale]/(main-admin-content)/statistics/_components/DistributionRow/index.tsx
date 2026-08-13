import { Progress } from 'antd';
import styles from './styles.module.scss';

export const percentOf = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);

const formatPercent = (value: number) => (value > 0 && value < 0.1 ? '<0.1' : value.toFixed(1));

type DistributionRowP = {
  label: string;
  count: number;
  total: number;
  showPercent?: boolean;
};

export const DistributionRow = ({ label, count, total, showPercent }: DistributionRowP) => (
  <div className={styles.distributionRow}>
    <span className={styles.distributionLabel}>{label}</span>
    <Progress percent={percentOf(count, total)} showInfo={false} size="small" />
    <span className={styles.distributionCount}>
      {count.toLocaleString()}
      {showPercent && (
        <span className={styles.distributionPercent}> ({formatPercent(percentOf(count, total))}%)</span>
      )}
    </span>
  </div>
);
