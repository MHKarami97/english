import type { Word } from '../entities';
import { shuffle, type RandomSource } from '../random';
import { containsEither, isNearlyIdentical } from './similarity';

export type OptionKind = 'word' | 'definition' | 'image';

export interface DistractorTier {
  readonly range: 'unit' | 'neighbors' | 'book';
  readonly samePos: boolean;
}

/** Same unit first, then neighboring units, then the whole book; same part of speech before any. */
export const DISTRACTOR_TIERS: readonly DistractorTier[] = [
  { range: 'unit', samePos: true },
  { range: 'unit', samePos: false },
  { range: 'neighbors', samePos: true },
  { range: 'neighbors', samePos: false },
  { range: 'book', samePos: true },
  { range: 'book', samePos: false },
];

/** Port: returns a small, indexed, randomly windowed candidate list for one tier. */
export interface DistractorPool {
  candidates(target: Word, tier: DistractorTier): Promise<readonly Word[]>;
}

export interface DistractorSelector {
  select(target: Word, kind: OptionKind, count: number): Promise<readonly Word[]>;
}

export class DistractorPoolTooSmallError extends Error {
  constructor(
    readonly wordId: string,
    readonly needed: number,
    readonly found: number,
  ) {
    super(`Only ${found} of ${needed} distractors were found for ${wordId}`);
    this.name = 'DistractorPoolTooSmallError';
  }
}

export function labelOf(word: Word, kind: OptionKind): string {
  if (kind === 'word') return word.word.trim().toLowerCase();
  if (kind === 'definition') return word.definition.trim().toLowerCase();
  return word.image;
}

/**
 * A candidate is rejected when it would make the question unfair: it leaks the answer in its text,
 * or its definition is nearly identical to the target's (a synonym the player cannot rule out).
 */
export function isEligible(target: Word, candidate: Word, kind: OptionKind): boolean {
  if (candidate.id === target.id) return false;
  if (containsEither(candidate.word, target.word)) return false;
  if (kind === 'definition' && candidate.definition.toLowerCase().includes(target.word.toLowerCase())) return false;
  if (candidate.definition && target.definition && isNearlyIdentical(candidate.definition, target.definition)) return false;
  return true;
}

export class TieredDistractorSelector implements DistractorSelector {
  constructor(
    private readonly pool: DistractorPool,
    private readonly random: RandomSource,
  ) {}

  async select(target: Word, kind: OptionKind, count: number): Promise<readonly Word[]> {
    const chosen: Word[] = [];
    const labels = new Set<string>([labelOf(target, kind)]);
    for (const tier of DISTRACTOR_TIERS) {
      if (chosen.length >= count) break;
      for (const candidate of shuffle(await this.pool.candidates(target, tier), this.random)) {
        if (chosen.length >= count) break;
        const label = labelOf(candidate, kind);
        if (!label || labels.has(label) || !isEligible(target, candidate, kind)) continue;
        chosen.push(candidate);
        labels.add(label);
      }
    }
    if (chosen.length < count) throw new DistractorPoolTooSmallError(target.id, count, chosen.length);
    return chosen;
  }
}
