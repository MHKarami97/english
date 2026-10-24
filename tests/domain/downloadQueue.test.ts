import { describe, expect, it } from 'vitest';
import { DownloadQueue } from '@/domain/download/DownloadQueue';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function gate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe('DownloadQueue', () => {
  it('never runs more items at once than the concurrency allows', async () => {
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => gate());
    const queue = new DownloadQueue<number>({
      concurrency: 2,
      worker: async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await gates[item]!.promise;
        active -= 1;
      },
    });
    queue.enqueue([0, 1, 2, 3, 4]);
    expect(queue.activeCount).toBe(2);
    expect(queue.pendingCount).toBe(3);
    for (const entry of gates) {
      entry.open();
      await tick();
    }
    await queue.drained();
    expect(peak).toBe(2);
  });

  it('aborts running work on pause and starts it again first on resume', async () => {
    const started: number[] = [];
    const queue = new DownloadQueue<number>({
      concurrency: 1,
      worker: (item, signal) =>
        new Promise<void>((resolve) => {
          started.push(item);
          const firstRunOfZero = item === 0 && started.filter((value) => value === 0).length === 1;
          if (firstRunOfZero) signal.addEventListener('abort', () => resolve());
          else resolve();
        }),
    });
    queue.enqueue([0, 1]);
    await tick();
    expect(started).toEqual([0]);

    queue.pause();
    expect(queue.isPaused).toBe(true);
    expect(queue.pendingCount).toBe(2);
    await tick();
    expect(started).toEqual([0]);

    queue.resume();
    await queue.drained();
    expect(started).toEqual([0, 0, 1]);
  });

  it('reports a failing item and keeps going', async () => {
    const done: number[] = [];
    const failed: number[] = [];
    const queue = new DownloadQueue<number>({
      concurrency: 2,
      worker: async (item) => {
        if (item === 1) throw new Error('boom');
        done.push(item);
      },
      onError: (item) => failed.push(item),
    });
    queue.enqueue([0, 1, 2]);
    await queue.drained();
    expect(done.sort()).toEqual([0, 2]);
    expect(failed).toEqual([1]);
  });

  it('drops everything that is waiting when it is cancelled', async () => {
    const started: number[] = [];
    const queue = new DownloadQueue<number>({
      concurrency: 1,
      worker: (item, signal) =>
        new Promise<void>((resolve) => {
          started.push(item);
          signal.addEventListener('abort', () => resolve());
        }),
    });
    queue.enqueue([0, 1, 2]);
    await tick();
    queue.cancel();
    await queue.drained();
    expect(queue.pendingCount).toBe(0);
    expect(started).toEqual([0]);
  });
});
