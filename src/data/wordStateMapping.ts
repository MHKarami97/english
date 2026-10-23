import type { UserWordState } from '@/domain/entities';
import type { StoredWordState } from './db/LexiDatabase';

export const toStoredState = (state: UserWordState): StoredWordState => ({
  wordId: state.wordId,
  bookId: state.bookId,
  favorite: state.isFavorite ? 1 : 0,
  knowledge: state.knowledge,
  updatedAt: state.updatedAt,
});

export const fromStoredState = (row: StoredWordState): UserWordState => ({
  wordId: row.wordId,
  bookId: row.bookId,
  isFavorite: row.favorite === 1,
  knowledge: row.knowledge,
  updatedAt: row.updatedAt,
});
