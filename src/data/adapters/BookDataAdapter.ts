import type { BookRef, Unit, Word } from '@/domain/entities';
import type { RawBookData } from '@/domain/raw';
import { parseExample } from '@/domain/parsing/example';
import { parsePronunciation } from '@/domain/parsing/pronunciation';

export interface AdaptedBook {
  readonly units: readonly Unit[];
  readonly words: readonly Word[];
}

/** Adapter: converts the third-party JSON shape into domain models with deterministic ids. */
export class BookDataAdapter {
  adapt(book: BookRef, raw: RawBookData): AdaptedBook {
    const units: Unit[] = [];
    const words: Word[] = [];

    (raw.flashcard ?? []).forEach((rawUnit, unitIndex) => {
      const unitOrder = unitIndex + 1;
      const unitId = `${book.id}:${unitOrder}`;
      units.push({
        id: unitId,
        bookId: book.id,
        order: unitOrder,
        title: rawUnit.en?.trim() || `Unit ${unitOrder}`,
        image: rawUnit.image ?? '',
      });

      (rawUnit.wordlist ?? []).forEach((rawWord, wordIndex) => {
        const text = (rawWord.en ?? '').trim();
        if (!text) return;
        const wordOrder = wordIndex + 1;
        const { ipa, pos } = parsePronunciation(rawWord.pron);
        words.push({
          id: `${book.id}:${unitOrder}:${wordOrder}`,
          bookId: book.id,
          unitId,
          order: wordOrder,
          word: text,
          ipa,
          pos,
          definition: (rawWord.desc ?? '').trim(),
          exampleSegments: parseExample(rawWord.exam ?? ''),
          translationFa: '',
          image: rawWord.image ?? '',
          sound: rawWord.sound ?? '',
        });
      });
    });

    return { units, words };
  }
}
