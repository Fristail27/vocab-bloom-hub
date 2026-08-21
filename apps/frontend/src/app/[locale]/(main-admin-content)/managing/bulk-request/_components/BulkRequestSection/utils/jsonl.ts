import { AbstractBaseApi } from '@/core/api/AbstractBaseApi';

/** One JSON object per line, newline-terminated — the dataset convention */
export const toJsonl = (lines: readonly unknown[]): string =>
  lines.map((line) => JSON.stringify(line)).join('\n') + '\n';

export const downloadJsonl = (lines: readonly unknown[], filename: string): void => {
  const blob = new Blob([toJsonl(lines)], { type: 'application/x-ndjson;charset=utf-8' });
  AbstractBaseApi.saveBlobAsFile(blob, filename);
};
