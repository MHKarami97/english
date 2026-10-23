import type { Clock } from '@/domain/scheduling/Clock';

export class FixedClock implements Clock {
  constructor(private current: number) {}

  now(): Date {
    return new Date(this.current);
  }

  set(timestamp: number): void {
    this.current = timestamp;
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}
