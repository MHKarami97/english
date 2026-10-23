import { DexieReviewLedger } from '@/data/review/DexieReviewLedger';
import {
  DexieDailyStatsRepository,
  DexieReviewCardRepository,
  DexieReviewLogRepository,
} from '@/data/review/ReviewRepositories';
import {
  DexieProgressRepository,
  DexieSettingsRepository,
  DexieUnitRepository,
  DexieWordRepository,
} from '@/data/repositories';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { QueueBuilder } from '@/application/QueueBuilder';
import { StreakService } from '@/application/StreakService';
import { StudyDayService } from '@/application/StudyDayService';
import { StudySessionService } from '@/application/StudySessionService';
import { StudySettingsService } from '@/application/StudySettingsService';
import { createSeededRandom } from '@/domain/random';
import type { Clock } from '@/domain/scheduling/Clock';
import { Sm2Scheduler } from '@/domain/scheduling/Sm2Scheduler';

export function createStudyKit(db: LexiDatabase, clock: Clock, seed = 1, timeZone = 'UTC') {
  const cards = new DexieReviewCardRepository(db);
  const logs = new DexieReviewLogRepository(db);
  const stats = new DexieDailyStatsRepository(db);
  const units = new DexieUnitRepository(db);
  const words = new DexieWordRepository(db);
  const progress = new DexieProgressRepository(db);
  const state = new DexieSettingsRepository(db);
  const ledger = new DexieReviewLedger(db, cards, logs, stats);
  const settings = new StudySettingsService(state);
  const studyDay = new StudyDayService(clock, timeZone);
  const queueBuilder = new QueueBuilder(cards, units, words, progress, createSeededRandom(seed));
  const streak = new StreakService(stats, studyDay);
  const newSession = () =>
    new StudySessionService({
      clock,
      studyDay,
      settings,
      queueBuilder,
      cards,
      words,
      stats,
      ledger,
      state,
      createScheduler: (calendar) => new Sm2Scheduler(calendar),
    });
  return { cards, logs, stats, units, words, progress, state, ledger, settings, studyDay, queueBuilder, streak, newSession };
}
