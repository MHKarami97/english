import type { LexiDatabase } from '../db/LexiDatabase';
import { fromStoredState, toStoredState } from '../wordStateMapping';
import { BACKUP_FORMAT, BACKUP_VERSION, type ProgressBackup } from './backupSchema';

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  readonly reviewCards: number;
  readonly reviewLogs: number;
  readonly dailyStats: number;
  readonly wordStates: number;
  readonly settings: number;
  readonly quizSessions: number;
  readonly quizAnswers: number;
  readonly mistakes: number;
  readonly placementResults: number;
}

const logKey = (wordId: string, reviewedAt: number): string => `${wordId}|${reviewedAt}`;
const quizLogKey = (sessionId: string, wordId: string, answeredAt: number): string => `${sessionId}|${wordId}|${answeredAt}`;

/** Exports and imports user data only; book content is never part of a backup. */
export class ProgressBackupService {
  constructor(
    private readonly db: LexiDatabase,
    private readonly appVersion: string,
  ) {}

  async export(now: number): Promise<ProgressBackup> {
    const [reviewCards, reviewLogs, dailyStats, wordStates, settings, quizSessions, quizAnswerLogs, mistakes, placementResults] =
      await Promise.all([
        this.db.reviewCards.toArray(),
        this.db.reviewLogs.toArray(),
        this.db.dailyStats.toArray(),
        this.db.userWordState.toArray(),
        this.db.settings.toArray(),
        this.db.quizSessions.toArray(),
        this.db.quizAnswerLogs.toArray(),
        this.db.mistakes.toArray(),
        this.db.placementResults.toArray(),
      ]);
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      appVersion: this.appVersion,
      data: {
        reviewCards,
        reviewLogs,
        dailyStats,
        userWordStates: wordStates.map(fromStoredState),
        settings,
        quizSessions,
        quizAnswerLogs,
        mistakes,
        placementResults,
      },
    };
  }

  /**
   * merge: the newer record wins per word (by last review, update or wrong-answer time), logs are
   * de-duplicated, daily counters take the larger value, and existing settings are kept.
   * replace: all user data is cleared first, then the file is written.
   */
  async import(backup: ProgressBackup, mode: ImportMode): Promise<ImportSummary> {
    const db = this.db;
    const { data } = backup;
    const tables = [
      db.reviewCards,
      db.reviewLogs,
      db.dailyStats,
      db.userWordState,
      db.settings,
      db.quizSessions,
      db.quizAnswerLogs,
      db.mistakes,
      db.placementResults,
    ];
    return db.transaction('rw', tables, async () => {
      if (mode === 'replace') {
        for (const table of tables) await table.clear();
      }

      const existingCards = await db.reviewCards.bulkGet(data.reviewCards.map((card) => card.wordId));
      const cards = data.reviewCards.filter((card, index) => {
        const current = existingCards[index];
        return !current || (card.lastReviewedAt ?? 0) > (current.lastReviewedAt ?? 0);
      });
      await db.reviewCards.bulkPut(cards);

      const knownLogs = new Set((await db.reviewLogs.toArray()).map((log) => logKey(log.wordId, log.reviewedAt)));
      const logs = data.reviewLogs
        .filter((log) => !knownLogs.has(logKey(log.wordId, log.reviewedAt)))
        .map(({ id: _id, ...log }) => log);
      await db.reviewLogs.bulkAdd(logs);

      const existingStats = await db.dailyStats.bulkGet(data.dailyStats.map((stats) => stats.dateKey));
      const stats = data.dailyStats.map((incoming, index) => {
        const current = existingStats[index];
        if (!current) return incoming;
        return {
          dateKey: incoming.dateKey,
          newCount: Math.max(incoming.newCount, current.newCount),
          reviewCount: Math.max(incoming.reviewCount, current.reviewCount),
          againCount: Math.max(incoming.againCount, current.againCount),
          totalDurationMs: Math.max(incoming.totalDurationMs, current.totalDurationMs),
        };
      });
      await db.dailyStats.bulkPut(stats);

      const existingStates = await db.userWordState.bulkGet(data.userWordStates.map((state) => state.wordId));
      const states = data.userWordStates
        .filter((state, index) => {
          const current = existingStates[index];
          return !current || state.updatedAt > current.updatedAt;
        })
        .map(toStoredState);
      await db.userWordState.bulkPut(states);

      const existingSettings = await db.settings.bulkGet(data.settings.map((setting) => setting.key));
      const settings = data.settings.filter((_, index) => mode === 'replace' || !existingSettings[index]);
      await db.settings.bulkPut(settings.map((setting) => ({ key: setting.key, value: setting.value })));

      const existingSessions = await db.quizSessions.bulkGet(data.quizSessions.map((session) => session.id));
      const sessions = data.quizSessions.filter((_, index) => !existingSessions[index]);
      await db.quizSessions.bulkPut(sessions);

      const knownQuizLogs = new Set(
        (await db.quizAnswerLogs.toArray()).map((log) => quizLogKey(log.sessionId, log.wordId, log.answeredAt)),
      );
      const quizLogs = data.quizAnswerLogs
        .filter((log) => !knownQuizLogs.has(quizLogKey(log.sessionId, log.wordId, log.answeredAt)))
        .map(({ id: _id, ...log }) => log);
      await db.quizAnswerLogs.bulkAdd(quizLogs);

      const existingMistakes = await db.mistakes.bulkGet(data.mistakes.map((mistake) => mistake.wordId));
      const mistakes = data.mistakes.filter((mistake, index) => {
        const current = existingMistakes[index];
        return !current || mistake.lastWrongAt > current.lastWrongAt;
      });
      await db.mistakes.bulkPut(mistakes);

      const existingPlacements = await db.placementResults.bulkGet(data.placementResults.map((result) => result.id));
      const placements = data.placementResults.filter((_, index) => !existingPlacements[index]);
      await db.placementResults.bulkPut(placements);

      return {
        reviewCards: cards.length,
        reviewLogs: logs.length,
        dailyStats: stats.length,
        wordStates: states.length,
        settings: settings.length,
        quizSessions: sessions.length,
        quizAnswers: quizLogs.length,
        mistakes: mistakes.length,
        placementResults: placements.length,
      };
    });
  }
}
