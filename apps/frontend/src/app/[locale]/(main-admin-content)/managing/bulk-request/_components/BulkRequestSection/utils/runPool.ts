export type RunPoolOptions = {
  concurrency: number;
  signal?: AbortSignal;
};

/**
 * Runs `worker` over `items` with at most `concurrency` calls in flight.
 * Items are picked in order; once the signal aborts no new item is started
 * (in-flight calls see the same signal and stop on their own).
 * Resolves when every started call has settled.
 */
export const runWithConcurrency = async <T>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<void>,
  { concurrency, signal }: RunPoolOptions,
): Promise<void> => {
  const workers = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  let next = 0;

  const lane = async () => {
    while (!signal?.aborted) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workers }, lane));
};
