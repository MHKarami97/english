import { SettingKey } from '@/application/settingKeys';
import type { Mistake } from '@/domain/quiz/models';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { LexiDatabase } from '../db/LexiDatabase';

interface Stash {
  readonly reviewCards: readonly ReviewCard[];
  readonly mistakes: readonly Mistake[];
}

export interface OrphanReport {
  readonly removed: number;
  readonly restored: number;
}

const MAX_STASHED = 500;

/**
 * After a content update some words may no longer exist. Their schedule cards and mistakes could
 * never be shown, so they leave the active tables, but they are parked in a stash and come back
 * if the word returns. Review history, daily statistics and word marks are never touched.
 */
export class OrphanReconciler {
  constructor(private readonly db: LexiDatabase) {}

  reconcile(bookId: string): Promise<OrphanReport> {
    const { db } = this;
    return db.transaction('rw', [db.words, db.reviewCards, db.mistakes, db.settings], async () => {
      const stored = await db.settings.get(SettingKey.orphanStash);
      const stash: Stash = (stored?.value as Stash | undefined) ?? { reviewCards: [], mistakes: [] };

      const missing = async (ids: readonly string[]): Promise<Set<string>> => {
        const rows = await db.words.bulkGet([...ids]);
        return new Set(ids.filter((_, index) => rows[index] === undefined));
      };

      const stashedGone = await missing([...stash.reviewCards, ...stash.mistakes].map((row) => row.wordId));
      const backCards = stash.reviewCards.filter((card) => !stashedGone.has(card.wordId));
      const backMistakes = stash.mistakes.filter((mistake) => !stashedGone.has(mistake.wordId));
      await db.reviewCards.bulkPut([...backCards]);
      await db.mistakes.bulkPut([...backMistakes]);

      const cards = await db.reviewCards.where('bookId').equals(bookId).toArray();
      const cardsGone = await missing(cards.map((card) => card.wordId));
      const orphanCards = cards.filter((card) => cardsGone.has(card.wordId));
      const mistakes = await db.mistakes.where('wordId').startsWith(`${bookId}:`).toArray();
      const mistakesGone = await missing(mistakes.map((mistake) => mistake.wordId));
      const orphanMistakes = mistakes.filter((mistake) => mistakesGone.has(mistake.wordId));
      await db.reviewCards.bulkDelete(orphanCards.map((card) => card.wordId));
      await db.mistakes.bulkDelete(orphanMistakes.map((mistake) => mistake.wordId));

      const next: Stash = {
        reviewCards: [...stash.reviewCards.filter((card) => stashedGone.has(card.wordId)), ...orphanCards].slice(-MAX_STASHED),
        mistakes: [...stash.mistakes.filter((mistake) => stashedGone.has(mistake.wordId)), ...orphanMistakes].slice(-MAX_STASHED),
      };
      await db.settings.put({ key: SettingKey.orphanStash, value: next });
      return {
        removed: orphanCards.length + orphanMistakes.length,
        restored: backCards.length + backMistakes.length,
      };
    });
  }
}
