import { ImportDictionaryChunkT } from 'server/types';
import { formatBytes } from '@/helpers/formatBytes';

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
};

export const getDownloadProgressStr = (c: ImportDictionaryChunkT) => {
  return c.downloaded && c.total ? `(${formatBytes(c.downloaded, 2, false)}/${formatBytes(c.total)})` : '';
};
