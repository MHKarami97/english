import type { RandomSource } from '../random';
import { HttpStatusError, StorageQuotaError } from './errors';

/** Strategy: decides whether and when a failed file is tried again. */
export interface RetryPolicy {
  readonly maxAttempts: number;
  /** Delay before attempt number `attempt + 1`; `attempt` starts at 1. */
  delayMs(attempt: number): number;
  isRetryable(error: unknown): boolean;
}

/** Exponential backoff with full jitter: a random delay between 0 and min(cap, base * 2^(attempt-1)). */
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(
    private readonly random: RandomSource,
    readonly maxAttempts = 4,
    private readonly baseMs = 400,
    private readonly capMs = 10_000,
  ) {}

  delayMs(attempt: number): number {
    const ceiling = Math.min(this.capMs, this.baseMs * 2 ** (attempt - 1));
    return Math.round(this.random.next() * ceiling);
  }

  isRetryable(error: unknown): boolean {
    if (error instanceof StorageQuotaError) return false;
    if ((error as { name?: string } | null)?.name === 'AbortError') return false;
    if (error instanceof HttpStatusError) return error.status === 408 || error.status === 429 || error.status >= 500;
    return true;
  }
}
