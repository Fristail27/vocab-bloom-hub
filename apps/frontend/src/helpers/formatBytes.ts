export function formatBytes(bytes: number, decimals = 2, withCount: boolean = true): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  const value = bytes / Math.pow(1024, index);
  let res = `${parseFloat(value.toFixed(decimals))}`;
  if (withCount) {
    res += ` ${units[index]}`;
  }
  return res;
}
