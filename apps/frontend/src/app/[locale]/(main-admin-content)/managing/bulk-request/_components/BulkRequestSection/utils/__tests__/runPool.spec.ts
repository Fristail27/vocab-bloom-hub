import { runWithConcurrency } from '../runPool';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('runWithConcurrency', () => {
  it('never runs more than `concurrency` workers at once and processes every item in order', async () => {
    let inFlight = 0;
    let peak = 0;
    const started: number[] = [];

    await runWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      async (item) => {
        started.push(item);
        inFlight++;
        peak = Math.max(peak, inFlight);
        await tick();
        await tick();
        inFlight--;
      },
      { concurrency: 3 },
    );

    expect(peak).toBe(3);
    expect(started).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('starts no new item after the signal aborts', async () => {
    const controller = new AbortController();
    const started: number[] = [];

    await runWithConcurrency(
      [1, 2, 3, 4, 5],
      async (item) => {
        started.push(item);
        if (item === 2) controller.abort();
        await tick();
      },
      { concurrency: 2, signal: controller.signal },
    );

    expect(started).toEqual([1, 2]);
  });

  it('handles an empty list and a concurrency above the item count', async () => {
    const worker = jest.fn(async () => undefined);
    await runWithConcurrency([], worker, { concurrency: 4 });
    expect(worker).not.toHaveBeenCalled();

    await runWithConcurrency(['a'], worker, { concurrency: 10 });
    expect(worker).toHaveBeenCalledTimes(1);
  });
});
