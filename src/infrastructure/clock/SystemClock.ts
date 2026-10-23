import type { Clock } from '@/domain/scheduling/Clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
