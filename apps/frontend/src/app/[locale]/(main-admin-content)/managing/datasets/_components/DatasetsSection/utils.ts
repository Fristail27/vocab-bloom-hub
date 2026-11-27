/** Megabytes the way a reader says them: `170 MB`, `1.4 GB` */
export const formatMegabytes = (megabytes: number, locale: string): string => {
  if (megabytes >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(megabytes / 1000)} GB`;
  }
  return `${new Intl.NumberFormat(locale).format(megabytes)} MB`;
};

export const formatCount = (count: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(count);

/** The server and browser may have different time zones when hydrating the same card. */
export const formatDatasetTime = (value: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC' }).format(
    new Date(value),
  );
