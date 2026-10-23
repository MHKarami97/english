import type { Mistake, PlacementResult, QuizAnswerLog, QuizSession } from '@/domain/quiz/models';
import type {
  MistakeRepository,
  PlacementRepository,
  QuizAnswerLogRepository,
  QuizSessionRepository,
} from '@/domain/quiz/ports';
import type { LexiDatabase } from '../db/LexiDatabase';

export class DexieQuizSessionRepository implements QuizSessionRepository {
  constructor(private readonly db: LexiDatabase) {}

  async put(session: QuizSession): Promise<void> {
    await this.db.quizSessions.put(session);
  }

  get(id: string): Promise<QuizSession | undefined> {
    return this.db.quizSessions.get(id);
  }

  recent(limit: number): Promise<readonly QuizSession[]> {
    return this.db.quizSessions.orderBy('startedAt').reverse().limit(limit).toArray();
  }

  clear(): Promise<void> {
    return this.db.quizSessions.clear();
  }
}

export class DexieQuizAnswerLogRepository implements QuizAnswerLogRepository {
  constructor(private readonly db: LexiDatabase) {}

  async add(log: QuizAnswerLog): Promise<number> {
    const id = await this.db.quizAnswerLogs.add(log);
    if (id === undefined) throw new Error('Quiz log was stored without an id');
    return id;
  }

  clear(): Promise<void> {
    return this.db.quizAnswerLogs.clear();
  }
}

export class DexieMistakeRepository implements MistakeRepository {
  constructor(private readonly db: LexiDatabase) {}

  get(wordId: string): Promise<Mistake | undefined> {
    return this.db.mistakes.get(wordId);
  }

  async put(mistake: Mistake): Promise<void> {
    await this.db.mistakes.put(mistake);
  }

  remove(wordId: string): Promise<void> {
    return this.db.mistakes.delete(wordId);
  }

  list(limit: number): Promise<readonly Mistake[]> {
    return this.db.mistakes.orderBy('lastWrongAt').reverse().limit(limit).toArray();
  }

  count(): Promise<number> {
    return this.db.mistakes.count();
  }

  wordIds(limit: number): Promise<readonly string[]> {
    return this.db.mistakes.orderBy('lastWrongAt').reverse().limit(limit).primaryKeys();
  }

  clear(): Promise<void> {
    return this.db.mistakes.clear();
  }
}

export class DexiePlacementRepository implements PlacementRepository {
  constructor(private readonly db: LexiDatabase) {}

  async put(result: PlacementResult): Promise<void> {
    await this.db.placementResults.put(result);
  }

  async latest(bookId: string): Promise<PlacementResult | undefined> {
    const results = await this.db.placementResults.where('bookId').equals(bookId).sortBy('takenAt');
    return results.at(-1);
  }
}
