import { describe, expect, it } from 'vitest';
import { HttpStatusError, StorageQuotaError } from '@/domain/download/errors';
import { ExponentialBackoffRetryPolicy } from '@/domain/download/RetryPolicy';

const half = { next: () => 0.5 };

describe('ExponentialBackoffRetryPolicy', () => {
  it('draws the delay from zero up to a ceiling that doubles and stops at the cap', () => {
    const policy = new ExponentialBackoffRetryPolicy(half, 4, 400, 10_000);
    expect(policy.delayMs(1)).toBe(200);
    expect(policy.delayMs(2)).toBe(400);
    expect(policy.delayMs(3)).toBe(800);
    expect(policy.delayMs(10)).toBe(5000);
  });

  it('can pick a zero delay and never goes above the ceiling', () => {
    expect(new ExponentialBackoffRetryPolicy({ next: () => 0 }).delayMs(3)).toBe(0);
    expect(new ExponentialBackoffRetryPolicy({ next: () => 0.999999 }, 4, 400, 10_000).delayMs(1)).toBeLessThanOrEqual(400);
  });

  it('retries network failures, timeouts, throttling and server errors', () => {
    const policy = new ExponentialBackoffRetryPolicy(half);
    expect(policy.isRetryable(new TypeError('network'))).toBe(true);
    expect(policy.isRetryable(new HttpStatusError(408, 'u'))).toBe(true);
    expect(policy.isRetryable(new HttpStatusError(429, 'u'))).toBe(true);
    expect(policy.isRetryable(new HttpStatusError(503, 'u'))).toBe(true);
  });

  it('does not retry missing files, a full disk or an abort', () => {
    const policy = new ExponentialBackoffRetryPolicy(half);
    expect(policy.isRetryable(new HttpStatusError(404, 'u'))).toBe(false);
    expect(policy.isRetryable(new StorageQuotaError())).toBe(false);
    expect(policy.isRetryable(new DOMException('stopped', 'AbortError'))).toBe(false);
  });
});
