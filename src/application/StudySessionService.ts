import type { SettingsRepository, WordRepository } from '@/domain/contracts';
import type { Word } from '@/domain/entities';
import type { Clock } from '@/domain/scheduling/Clock';
import { createNewCard } from '@/domain/scheduling/createNewCard';
import type { SchedulerStrategy } from '@/domain/scheduling/SchedulerStrategy';
import type { Interval, Rating, ReviewCard } from '@/domain/scheduling/types';
import { emptyDailyStats, type ReviewLog, type StudySettings } from '@/domain/study/models';
import type {
  DailyStatsRepository,
  ReviewCardRepository,
  ReviewLedger,
  RevertEntry,
} from '@/domain/study/ports';
import type { StudyCalendar } from '@/domain/study/StudyCalendar';
import type { QueueBuilder, QueueEntry } from './QueueBuilder';
import { SettingKey } from './settingKeys';
import type { StudyDayService } from './StudyDayService';
import type { StudySettingsService } from './StudySettingsService';

// Again comes back after a few other cards; Hard on a brand-new card gets one later, shorter repeat.
const REQUEUE_AGAIN_GAP = 3;
const REQUEUE_HARD_NEW_GAP = 6;
const MAX_ANSWER_MS = 120_000;

export interface SessionCard {
  readonly word: Word;
  readonly card: ReviewCard;
  readonly kind: 'review' | 'new';
  readonly drill: boolean;
}

export type SessionStatus = 'idle' | 'active' | 'finished';

export interface SessionView {
  readonly status: SessionStatus;
  readonly current: SessionCard | null;
  readonly revealed: boolean;
  readonly remaining: number;
  readonly total: number;
  readonly answered: number;
  readonly canUndo: boolean;
  readonly resumed: boolean;
  readonly preview: Record<Rating, Interval> | null;
}

export interface SessionTally {
  readonly answered: number;
  readonly byRating: Readonly<Record<Rating, number>>;
  readonly durationMs: number;
}

export interface SessionSummary extends SessionTally {
  /** Share of scheduled answers that were not Again. */
  readonly accuracy: number;
  readonly nextDueAt: number | null;
}

export interface StudySessionDeps {
  readonly clock: Clock;
  readonly studyDay: StudyDayService;
  readonly settings: StudySettingsService;
  readonly queueBuilder: QueueBuilder;
  readonly cards: ReviewCardRepository;
  readonly words: WordRepository;
  readonly stats: DailyStatsRepository;
  readonly ledger: ReviewLedger;
  readonly state: SettingsRepository;
  readonly createScheduler: (calendar: StudyCalendar) => SchedulerStrategy;
}

interface SessionContext {
  readonly bookId: string;
  readonly settings: StudySettings;
  readonly calendar: StudyCalendar;
  readonly scheduler: SchedulerStrategy;
  readonly dayKey: string;
}

interface UndoEntry {
  readonly queue: QueueEntry[];
  readonly tally: SessionTally;
  /** null for in-session repeats, which never touch the database. */
  readonly revert: RevertEntry | null;
}

interface PersistedSession {
  readonly bookId: string;
  readonly dayKey: string;
  readonly queue: QueueEntry[];
  readonly total: number;
  readonly tally: SessionTally;
}

const emptyTally = (): SessionTally => ({
  answered: 0,
  byRating: { again: 0, hard: 0, good: 0, easy: 0 },
  durationMs: 0,
});

const isQueueEntry = (value: unknown): value is QueueEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as QueueEntry).wordId === 'string' &&
  ((value as QueueEntry).kind === 'review' || (value as QueueEntry).kind === 'new');

export class StudySessionService {
  private context: SessionContext | null = null;
  private queue: QueueEntry[] = [];
  private words = new Map<string, Word>();
  private cards = new Map<string, ReviewCard>();
  private undoStack: UndoEntry[] = [];
  private tally: SessionTally = emptyTally();
  private current: SessionCard | null = null;
  private status: SessionStatus = 'idle';
  private revealed = false;
  private resumed = false;
  private total = 0;
  private shownAt = 0;
  private busy = false;

  constructor(private readonly deps: StudySessionDeps) {}

  async start(bookId: string, options: { extraNew?: number } = {}): Promise<SessionView> {
    const settings = await this.deps.settings.load();
    const rollover = settings.dayRolloverHour;
    const calendar = this.deps.studyDay.calendar(rollover);
    const dayKey = this.deps.studyDay.todayKey(rollover);
    this.context = { bookId, settings, calendar, scheduler: this.deps.createScheduler(calendar), dayKey };
    this.undoStack = [];

    const saved = options.extraNew ? null : await this.readSaved(bookId, dayKey);
    if (saved) {
      this.queue = saved.queue.filter(isQueueEntry);
      this.total = saved.total;
      this.tally = saved.tally;
      this.resumed = true;
    } else {
      const todayStats = (await this.deps.stats.get(dayKey)) ?? emptyDailyStats(dayKey);
      const plan = await this.deps.queueBuilder.build({
        bookId,
        settings,
        todayStats,
        dueBefore: this.deps.studyDay.endOfToday(rollover),
        extraNew: options.extraNew,
      });
      this.queue = [...plan.entries];
      this.total = this.queue.length;
      this.tally = emptyTally();
      this.resumed = false;
    }

    await this.hydrate();
    await this.persist();
    this.present();
    return this.view();
  }

  reveal(): SessionView {
    if (this.status === 'active' && this.current) this.revealed = true;
    return this.view();
  }

  async answer(rating: Rating): Promise<SessionView> {
    const context = this.context;
    const current = this.current;
    const entry = this.queue[0];
    if (!context || !current || !entry || !this.revealed || this.busy) return this.view();

    this.busy = true;
    try {
      const before = { queue: [...this.queue], tally: this.tally };
      const revert = current.drill ? this.answerDrill(entry, rating) : await this.answerScheduled(context, current, entry, rating);
      this.undoStack.push({ ...before, revert });
      await this.persist();
      this.present();
      return this.view();
    } finally {
      this.busy = false;
    }
  }

  async undo(): Promise<SessionView> {
    const last = this.undoStack.at(-1);
    if (!last || this.busy || !this.context) return this.view();

    this.busy = true;
    try {
      if (last.revert) {
        await this.deps.ledger.revert(last.revert);
        const { previousCard, log } = last.revert;
        if (previousCard) this.cards.set(log.wordId, previousCard);
        else this.cards.delete(log.wordId);
      }
      this.undoStack.pop();
      this.queue = [...last.queue];
      this.tally = last.tally;
      await this.persist();
      this.present();
      return this.view();
    } finally {
      this.busy = false;
    }
  }

  async summary(): Promise<SessionSummary> {
    const context = this.context;
    const { answered, byRating } = this.tally;
    const nextDueAt = context
      ? await this.deps.cards.earliestDueAfter(context.bookId, this.deps.studyDay.endOfToday(context.settings.dayRolloverHour))
      : null;
    return {
      ...this.tally,
      accuracy: answered === 0 ? 0 : (answered - byRating.again) / answered,
      nextDueAt,
    };
  }

  view(): SessionView {
    const context = this.context;
    const current = this.current;
    const showPreview = this.revealed && current !== null && !current.drill && context?.settings.showIntervalsOnButtons === true;
    return {
      status: this.status,
      current,
      revealed: this.revealed,
      remaining: this.queue.length,
      total: this.total,
      answered: this.tally.answered,
      canUndo: this.undoStack.length > 0,
      resumed: this.resumed,
      preview: showPreview && context ? context.scheduler.previewIntervals(current.card, this.deps.clock.now()) : null,
    };
  }

  private answerDrill(entry: QueueEntry, rating: Rating): null {
    this.queue.shift();
    if (rating === 'again' || rating === 'hard') this.requeue(entry, REQUEUE_AGAIN_GAP);
    return null;
  }

  private async answerScheduled(
    context: SessionContext,
    current: SessionCard,
    entry: QueueEntry,
    rating: Rating,
  ): Promise<RevertEntry> {
    const now = this.deps.clock.now();
    const next = context.scheduler.schedule(current.card, rating, now);
    const reviewedAt = next.lastReviewedAt ?? now.getTime();
    const log: ReviewLog = {
      wordId: next.wordId,
      bookId: next.bookId,
      rating,
      previousState: current.card.state,
      previousInterval: current.card.intervalDays,
      newInterval: next.intervalDays,
      easeBefore: current.card.ease,
      easeAfter: next.ease,
      reviewedAt,
      durationMs: Math.min(MAX_ANSWER_MS, Math.max(0, now.getTime() - this.shownAt)),
    };
    const dateKey = context.calendar.dayKey(reviewedAt);
    const logId = await this.deps.ledger.record({ card: next, log, dateKey });

    const wasNew = entry.kind === 'new';
    this.cards.set(next.wordId, next);
    this.queue.shift();
    if (rating === 'again') this.requeue(entry, REQUEUE_AGAIN_GAP);
    else if (rating === 'hard' && wasNew) this.requeue(entry, REQUEUE_HARD_NEW_GAP);

    this.tally = {
      answered: this.tally.answered + 1,
      byRating: { ...this.tally.byRating, [rating]: this.tally.byRating[rating] + 1 },
      durationMs: this.tally.durationMs + log.durationMs,
    };
    return { logId, log, previousCard: wasNew ? null : current.card, dateKey };
  }

  private requeue(entry: QueueEntry, gap: number): void {
    this.queue.splice(Math.min(gap, this.queue.length), 0, { wordId: entry.wordId, kind: entry.kind, drill: true });
  }

  /** Loads only the words and cards of this queue (about a hundred), never the whole collection. */
  private async hydrate(): Promise<void> {
    const ids = [...new Set(this.queue.map((entry) => entry.wordId))];
    const [words, cards] = await Promise.all([this.deps.words.getMany(ids), this.deps.cards.getMany(ids)]);
    this.words = new Map(words.map((word) => [word.id, word]));
    this.cards = new Map(cards);
    this.queue = this.queue.filter(
      (entry) => this.words.has(entry.wordId) && !(entry.kind === 'new' && !entry.drill && this.cards.has(entry.wordId)),
    );
  }

  private present(): void {
    const entry = this.queue[0];
    if (!entry) {
      this.current = null;
      this.status = 'finished';
      this.revealed = false;
      return;
    }
    const word = this.words.get(entry.wordId);
    if (!word) {
      this.queue.shift();
      this.present();
      return;
    }
    const now = this.deps.clock.now().getTime();
    this.current = {
      word,
      card: this.cards.get(word.id) ?? createNewCard({ ...word, wordId: word.id }, now),
      kind: entry.kind,
      drill: entry.drill === true,
    };
    this.status = 'active';
    this.revealed = false;
    this.shownAt = now;
  }

  private async readSaved(bookId: string, dayKey: string): Promise<PersistedSession | null> {
    const saved = await this.deps.state.get<PersistedSession | null>(SettingKey.studySession, null);
    if (!saved || saved.bookId !== bookId || saved.dayKey !== dayKey) return null;
    if (!Array.isArray(saved.queue) || saved.queue.length === 0) return null;
    return saved;
  }

  /** Written after every answer so a refresh resumes with exactly the cards still left. */
  private async persist(): Promise<void> {
    const context = this.context;
    if (!context) return;
    const value: PersistedSession | null =
      this.queue.length === 0
        ? null
        : { bookId: context.bookId, dayKey: context.dayKey, queue: this.queue, total: this.total, tally: this.tally };
    await this.deps.state.set(SettingKey.studySession, value);
  }
}
