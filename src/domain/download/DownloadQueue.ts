export interface DownloadQueueOptions<T> {
  readonly concurrency: number;
  /** Must return (not throw) when its signal aborts. */
  readonly worker: (item: T, signal: AbortSignal) => Promise<void>;
  readonly onError?: (item: T, error: unknown) => void;
}

/**
 * Pure scheduling: runs at most `concurrency` workers, keeps order, and can pause (in-flight work
 * is aborted and goes back to the front), resume and cancel. It knows nothing about fetch or caches.
 */
export class DownloadQueue<T> {
  private pending: T[] = [];
  private readonly active = new Map<T, AbortController>();
  private waiters: Array<() => void> = [];
  private paused = false;
  private cancelled = false;

  constructor(private readonly options: DownloadQueueOptions<T>) {}

  get isPaused(): boolean {
    return this.paused;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get activeCount(): number {
    return this.active.size;
  }

  enqueue(items: readonly T[]): void {
    if (this.cancelled) return;
    this.pending.push(...items);
    this.pump();
  }

  pause(): void {
    if (this.paused || this.cancelled) return;
    this.paused = true;
    const interrupted = [...this.active.keys()];
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
    this.pending.unshift(...interrupted);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pump();
  }

  cancel(): void {
    this.cancelled = true;
    this.paused = false;
    this.pending = [];
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
    this.settle();
  }

  /** Resolves when nothing is pending or running. Stays pending while paused with work left. */
  drained(): Promise<void> {
    if (this.isDrained()) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private isDrained(): boolean {
    return this.active.size === 0 && this.pending.length === 0;
  }

  private pump(): void {
    while (!this.paused && !this.cancelled && this.active.size < this.options.concurrency) {
      const item = this.pending.shift();
      if (item === undefined) break;
      this.launch(item);
    }
    this.settle();
  }

  private launch(item: T): void {
    const controller = new AbortController();
    this.active.set(item, controller);
    void this.options
      .worker(item, controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) this.options.onError?.(item, error);
      })
      .finally(() => {
        if (this.active.get(item) === controller) this.active.delete(item);
        this.pump();
      });
  }

  private settle(): void {
    if (!this.isDrained()) return;
    this.waiters.splice(0).forEach((resolve) => resolve());
  }
}
