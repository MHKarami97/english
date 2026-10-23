import type { UnitRepository } from '@/domain/contracts';
import type { Unit, Word } from '@/domain/entities';
import type { DistractorPool, DistractorTier } from '@/domain/quiz/distractors';
import type { RandomSource } from '@/domain/random';
import type { LexiDatabase } from '../db/LexiDatabase';

const POOL_LIMIT = 40;
const NEIGHBOR_RADIUS = 2;

type WordCollection = ReturnType<LexiDatabase['words']['toCollection']>;

/** Every tier is an indexed query that reads at most POOL_LIMIT rows from a random offset. */
export class DexieDistractorPool implements DistractorPool {
  private readonly unitCache = new Map<string, Promise<readonly Unit[]>>();

  constructor(
    private readonly db: LexiDatabase,
    private readonly units: UnitRepository,
    private readonly random: RandomSource,
  ) {}

  async candidates(target: Word, tier: DistractorTier): Promise<readonly Word[]> {
    if (tier.samePos && target.posTags.length === 0) return [];
    const accepts = (word: Word): boolean =>
      word.id !== target.id && (!tier.samePos || word.posTags.some((tag) => target.posTags.includes(tag)));

    if (tier.range === 'unit') {
      return this.window(this.db.words.where('unitId').equals(target.unitId).filter(accepts));
    }
    if (tier.range === 'neighbors') {
      const unitIds = await this.neighborUnitIds(target);
      return unitIds.length === 0 ? [] : this.window(this.db.words.where('unitId').anyOf(unitIds).filter(accepts));
    }
    return tier.samePos
      ? this.window(
          this.db.words
            .where('posTags')
            .anyOf(target.posTags)
            .distinct()
            .filter((word) => word.bookId === target.bookId && accepts(word)),
        )
      : this.window(this.db.words.where('bookId').equals(target.bookId).filter(accepts));
  }

  private async window(collection: WordCollection): Promise<readonly Word[]> {
    const total = await collection.clone().count();
    if (total === 0) return [];
    const offset = Math.floor(this.random.next() * Math.max(1, total - POOL_LIMIT + 1));
    return collection.offset(offset).limit(POOL_LIMIT).toArray();
  }

  private async neighborUnitIds(target: Word): Promise<readonly string[]> {
    let pending = this.unitCache.get(target.bookId);
    if (!pending) {
      pending = this.units.listByBook(target.bookId);
      this.unitCache.set(target.bookId, pending);
    }
    const units = await pending;
    const own = units.find((unit) => unit.id === target.unitId);
    if (!own) return [];
    return units
      .filter((unit) => unit.id !== own.id && Math.abs(unit.order - own.order) <= NEIGHBOR_RADIUS)
      .map((unit) => unit.id);
  }
}
