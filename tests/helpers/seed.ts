import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { makeWord } from './builders';

export async function seedBook(db: LexiDatabase, wordsPerUnit: readonly number[]): Promise<void> {
  await db.units.bulkPut(
    wordsPerUnit.map((_, index) => ({
      id: `b:${index + 1}`,
      bookId: 'b',
      order: index + 1,
      title: `Unit ${index + 1}`,
      image: '',
    })),
  );
  await db.words.bulkPut(
    wordsPerUnit.flatMap((count, unit) => Array.from({ length: count }, (_, word) => makeWord(unit + 1, word + 1))),
  );
}
