/** Keep SQL parameter counts and buffered article JSON bounded on both database engines. */
export const RECONCILIATION_BATCH_SIZE = 100;

export async function* batches<T>(rows: AsyncIterable<T>): AsyncGenerator<T[]> {
  let page: T[] = [];
  for await (const row of rows) {
    page.push(row);
    if (page.length === RECONCILIATION_BATCH_SIZE) {
      yield page;
      page = [];
    }
  }
  if (page.length) yield page;
}
