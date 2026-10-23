import { BootstrapService } from '@/application/BootstrapService';
import { LibraryService } from '@/application/LibraryService';
import { MatchingGame } from '@/application/MatchingGame';
import { PlacementTestService } from '@/application/PlacementTestService';
import { PracticeHubService } from '@/application/PracticeHubService';
import { ProgressService } from '@/application/ProgressService';
import { QueueBuilder } from '@/application/QueueBuilder';
import { QuizSessionService } from '@/application/QuizSessionService';
import { QuizSettingsService } from '@/application/QuizSettingsService';
import { ReviewResetService } from '@/application/ReviewResetService';
import { ScopeResolver } from '@/application/ScopeResolver';
import { SearchService } from '@/application/SearchService';
import { StreakService } from '@/application/StreakService';
import { StudyDayService } from '@/application/StudyDayService';
import { StudyService } from '@/application/StudyService';
import { StudySessionService } from '@/application/StudySessionService';
import { StudySettingsService } from '@/application/StudySettingsService';
import { TodayService } from '@/application/TodayService';
import { ProgressBackupService } from '@/data/backup/ProgressBackupService';
import { HttpBookIndex } from '@/data/content/HttpBookIndex';
import { HttpContentPack } from '@/data/content/HttpContentPack';
import { LexiDatabase } from '@/data/db/LexiDatabase';
import { BookImporter } from '@/data/import/BookImporter';
import { DexieQuizLedger } from '@/data/quiz/DexieQuizLedger';
import { DexieDistractorPool } from '@/data/quiz/DexieDistractorPool';
import { DexieKnownMarker, DexieWordQueries } from '@/data/quiz/DexieWordQueries';
import {
  DexieMistakeRepository,
  DexiePlacementRepository,
  DexieQuizAnswerLogRepository,
  DexieQuizSessionRepository,
} from '@/data/quiz/QuizRepositories';
import {
  DexieBookRepository,
  DexieProgressRepository,
  DexieSettingsRepository,
  DexieUnitRepository,
  DexieWordRepository,
} from '@/data/repositories';
import { DexieReviewLedger } from '@/data/review/DexieReviewLedger';
import {
  DexieDailyStatsRepository,
  DexieReviewCardRepository,
  DexieReviewLogRepository,
} from '@/data/review/ReviewRepositories';
import { TieredDistractorSelector } from '@/domain/quiz/distractors';
import { createDefaultQuestionFactory } from '@/domain/quiz/strategies';
import { createSeededRandom, type RandomSource } from '@/domain/random';
import { Sm2Scheduler } from '@/domain/scheduling/Sm2Scheduler';
import { AudioPlayer } from '@/infrastructure/audio/AudioPlayer';
import { SystemClock } from '@/infrastructure/clock/SystemClock';
import { BrowserMediaAvailability } from '@/infrastructure/media/BrowserMediaAvailability';
import { MediaUrlResolver } from '@/infrastructure/media/MediaUrlResolver';
import { MathRandomSource } from '@/infrastructure/random/MathRandomSource';
import { StorageEstimator } from '@/infrastructure/storage/StorageEstimator';

// Composition root: the only place that knows which concrete classes implement the domain contracts.
const db = new LexiDatabase();
const bookRepository = new DexieBookRepository(db);
const unitRepository = new DexieUnitRepository(db);
const wordRepository = new DexieWordRepository(db);
const progressRepository = new DexieProgressRepository(db);
const settingsRepository = new DexieSettingsRepository(db);
const reviewCards = new DexieReviewCardRepository(db);
const reviewLogs = new DexieReviewLogRepository(db);
const dailyStats = new DexieDailyStatsRepository(db);
const ledger = new DexieReviewLedger(db, reviewCards, reviewLogs, dailyStats);

const clock = new SystemClock();
const studyDay = new StudyDayService(clock);
const studySettings = new StudySettingsService(settingsRepository);
const queueBuilder = new QueueBuilder(reviewCards, unitRepository, wordRepository, progressRepository, new MathRandomSource());
const streak = new StreakService(dailyStats, studyDay);
const media = new MediaUrlResolver();

// Practice (Phase 3). Nothing below imports the review ledger or the scheduler: quiz results
// can never change an SM-2 schedule.
const quizSessions = new DexieQuizSessionRepository(db);
const quizLogs = new DexieQuizAnswerLogRepository(db);
const mistakes = new DexieMistakeRepository(db);
const placements = new DexiePlacementRepository(db);
const quizLedger = new DexieQuizLedger(db, quizLogs, mistakes);
const wordQueries = new DexieWordQueries(db);
const quizSettings = new QuizSettingsService(settingsRepository);
const questionFactory = createDefaultQuestionFactory();
const seedSource = new MathRandomSource();
const scopeResolver = new ScopeResolver(wordQueries, progressRepository, reviewCards, mistakes, studyDay, studySettings);
const createSelector = (random: RandomSource) =>
  new TieredDistractorSelector(new DexieDistractorPool(db, unitRepository, random), random);

export const container = {
  settings: settingsRepository,
  media,
  audio: new AudioPlayer(),
  storage: new StorageEstimator(),
  bootstrap: new BootstrapService(
    bookRepository,
    new BookImporter(db),
    new HttpBookIndex(),
    (book) => new HttpContentPack(book),
  ),
  library: new LibraryService(unitRepository, wordRepository, progressRepository),
  progress: new ProgressService(progressRepository, settingsRepository),
  study: new StudyService(unitRepository, wordRepository, progressRepository, settingsRepository),
  search: new SearchService(unitRepository, wordRepository),
  clock,
  studyDay,
  studySettings,
  streak,
  today: new TodayService(studySettings, studyDay, queueBuilder, dailyStats, reviewLogs, streak),
  reset: new ReviewResetService(reviewCards, ledger, settingsRepository),
  backup: new ProgressBackupService(db, __APP_VERSION__),
  createSession: (): StudySessionService =>
    new StudySessionService({
      clock,
      studyDay,
      settings: studySettings,
      queueBuilder,
      cards: reviewCards,
      words: wordRepository,
      stats: dailyStats,
      ledger,
      state: settingsRepository,
      createScheduler: (calendar) => new Sm2Scheduler(calendar),
    }),
  quizSettings,
  practiceHub: new PracticeHubService(mistakes, placements, settingsRepository),
  mistakes,
  createQuiz: (): QuizSessionService =>
    new QuizSessionService({
      clock,
      seedSource,
      createRandom: createSeededRandom,
      createSelector,
      factory: questionFactory,
      resolver: scopeResolver,
      words: wordRepository,
      ledger: quizLedger,
      sessions: quizSessions,
      state: settingsRepository,
      settings: quizSettings,
      media: new BrowserMediaAvailability(media),
    }),
  createMatching: (): MatchingGame =>
    new MatchingGame({
      clock,
      seedSource,
      createRandom: createSeededRandom,
      resolver: scopeResolver,
      words: wordRepository,
      ledger: quizLedger,
      sessions: quizSessions,
    }),
  createPlacement: (): PlacementTestService =>
    new PlacementTestService({
      clock,
      seedSource,
      createRandom: createSeededRandom,
      createSelector,
      factory: questionFactory,
      units: unitRepository,
      words: wordRepository,
      queries: wordQueries,
      results: placements,
      studySettings,
      marker: new DexieKnownMarker(db),
      state: settingsRepository,
    }),
} as const;

export type Container = typeof container;
