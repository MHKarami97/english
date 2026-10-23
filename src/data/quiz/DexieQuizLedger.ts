import { applyMistakeAnswer } from '@/domain/quiz/mistakes';
import type {
  MistakeRepository,
  QuizAnswerLogRepository,
  QuizLedger,
  QuizLedgerEntry,
} from '@/domain/quiz/ports';
import type { LexiDatabase } from '../db/LexiDatabase';

/** Same pattern as the review ledger: the repositories join the ambient Dexie transaction. */
export class DexieQuizLedger implements QuizLedger {
  constructor(
    private readonly db: LexiDatabase,
    private readonly logs: QuizAnswerLogRepository,
    private readonly mistakes: MistakeRepository,
  ) {}

  recordAnswer(entry: QuizLedgerEntry): Promise<void> {
    const { log } = entry;
    return this.db.transaction('rw', this.db.quizAnswerLogs, this.db.mistakes, async () => {
      await this.logs.add(log);
      const current = (await this.mistakes.get(log.wordId)) ?? null;
      const next = applyMistakeAnswer(current, {
        wordId: log.wordId,
        questionType: log.questionType,
        correct: log.correct,
        at: log.answeredAt,
        practicing: entry.practicingMistakes,
      });
      if (next) await this.mistakes.put(next);
      else if (current) await this.mistakes.remove(log.wordId);
    });
  }
}
