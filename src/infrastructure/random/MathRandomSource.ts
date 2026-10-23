import type { RandomSource } from '@/domain/random';

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
