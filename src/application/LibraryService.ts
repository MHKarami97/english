import type { ProgressRepository, UnitRepository, WordRepository } from '@/domain/contracts';
import type { Unit } from '@/domain/entities';

export interface UnitSummary {
  readonly unit: Unit;
  readonly total: number;
  readonly known: number;
}

export interface LibrarySnapshot {
  readonly units: readonly UnitSummary[];
  readonly totalWords: number;
  readonly knownWords: number;
}

export class LibraryService {
  constructor(
    private readonly units: UnitRepository,
    private readonly words: WordRepository,
    private readonly progress: ProgressRepository,
  ) {}

  async snapshot(bookId: string): Promise<LibrarySnapshot> {
    const [units, words, knownIds] = await Promise.all([
      this.units.listByBook(bookId),
      this.words.listByBook(bookId),
      this.progress.listKnownIds(bookId),
    ]);

    const known = new Set(knownIds);
    const totals = new Map<string, { total: number; known: number }>();
    for (const word of words) {
      const entry = totals.get(word.unitId) ?? { total: 0, known: 0 };
      entry.total += 1;
      if (known.has(word.id)) entry.known += 1;
      totals.set(word.unitId, entry);
    }

    const summaries = units.map((unit) => ({
      unit,
      total: totals.get(unit.id)?.total ?? 0,
      known: totals.get(unit.id)?.known ?? 0,
    }));
    return { units: summaries, totalWords: words.length, knownWords: knownIds.length };
  }
}
