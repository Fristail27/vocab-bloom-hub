export type PendingExport = {
  filePath: string;
  createdAt: number;
  timeout: NodeJS.Timeout;
};
