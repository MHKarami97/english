import type { SettingsRepository, WordRepository } from '@/domain/contracts';
import type { Word } from '@/domain/entities';
import { DistractorPoolTooSmallError, type DistractorSelector } from '@/domain/quiz/distractors';
import { gradeOutcome, type Grade } from '@/domain/quiz/grading';
import type { PracticeScope, QuizAnswerLog, QuizMode, QuizSession, QuizSettings } from '@/domain/quiz/models';
import type { QuizLedger, QuizSessionRepository } from '@/domain/quiz/ports';
import type { Question } from '@/domain/quiz/questions';
import type { QuestionFactory } from '@/domain/quiz/strategies';
import { shuffle, type RandomSource } from '@/domain/random';
import type { Clock } from '@/domain/scheduling/Clock';
import type { MediaAvailability } from './MediaAvailability';
import type { QuizSettingsService } from './QuizSettingsService';
import type { ScopeResolver } from './ScopeResolver';
import { SettingKey } from './settingKeys';

type QuestionType = Question['type'];

const MCQ_TYPES: readonly QuestionType[] = ['mcq-definition-to-word', 'mcq-word-to-definition'];
const PICTURE_TYPES: readonly QuestionType[] = ['mcq-image-to-word', 'mcq-word-to-image'];
const ALL_TYPES: readonly QuestionType[] = [
  ...MCQ_TYPES,
  ...PICTURE_TYPES,
  'cloze-choice',
  'cloze-typing',
  'dictation',
];

const MODE_TYPES: Readonly<Record<QuizMode, readonly QuestionType[]>> = {
  mcq: MCQ_TYPES,
  cloze: ['cloze-choice', 'cloze-typing'],
  dictation: ['dictation'],
  pictures: PICTURE_TYPES,
  mixed: ALL_TYPES,
  timed: [...MCQ_TYPES, ...PICTURE_TYPES, 'cloze-choice'],
  mistakes: ALL_TYPES,
};

const MAX_ANSWER_MS = 120_000;

export interface QuizRequest {
  readonly bookId: string;
  readonly mode: QuizMode;
  readonly scope: PracticeScope;
  readonly count?: number;
}

export interface QuizCurrent {
  readonly question: Question;
  readonly target: Word;
  /** Words whose pictures appear in the question (the target is always included). */
  readonly related: ReadonlyMap<string, Word>;
  readonly position: number;
}

export type QuizStatus = 'idle' | 'question' | 'feedback' | 'finished';

export interface QuizView {
  readonly status: QuizStatus;
  readonly current: QuizCurrent | null;
  readonly grade: Grade | null;
  readonly mode: QuizMode | null;
  readonly answered: number;
  readonly total: number | null;
  readonly correct: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly paused: boolean;
  readonly timed: boolean;
  readonly empty: boolean;
  readonly remainingMs: number | null;
  readonly showHints: boolean;
  readonly autoPlayAudio: boolean;
  readonly autoAdvance: boolean;
}

export interface QuizSummary {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly durationMs: number;
  readonly bestStreak: number;
  readonly missed: readonly Word[];
  readonly skippedAudio: number;
  readonly skippedImages: number;
}

interface PersistedQuiz {
  readonly sessionId: string;
  readonly bookId: string;
  readonly mode: QuizMode;
  readonly scope: PracticeScope;
  readonly seed: number;
  readonly plan: readonly string[];
  readonly position: number;
  readonly startedAt: number;
  readonly answered: number;
  readonly correct: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly missedIds: readonly string[];
  readonly durationMs: number;
  readonly skippedAudio: number;
  readonly skippedImages: number;
  readonly excluded: readonly string[];
  readonly remainingMs: number | null;
}

export interface SavedQuizMeta {
  readonly mode: QuizMode;
  readonly answered: number;
  readonly total: number;
}

/** Lets the practice hub offer "Resume" without building a session. */
export async function readSavedQuiz(state: SettingsRepository, bookId: string): Promise<SavedQuizMeta | null> {
  const saved = await state.get<PersistedQuiz | null>(SettingKey.quizSession, null);
  if (!saved || saved.bookId !== bookId) return null;
  return { mode: saved.mode, answered: saved.answered, total: saved.mode === 'timed' ? 0 : saved.plan.length };
}

export interface QuizSessionDeps {
  readonly clock: Clock;
  readonly seedSource: RandomSource;
  readonly createRandom: (seed: number) => RandomSource;
  readonly createSelector: (random: RandomSource) => DistractorSelector;
  readonly factory: QuestionFactory;
  readonly resolver: ScopeResolver;
  readonly words: WordRepository;
  readonly ledger: QuizLedger;
  readonly sessions: QuizSessionRepository;
  readonly state: SettingsRepository;
  readonly settings: QuizSettingsService;
  readonly media: MediaAvailability;
}

const mixSeed = (seed: number, position: number): number => (seed ^ Math.imul(position + 1, 0x9e3779b1)) >>> 0;

function buildPlan(ids: readonly string[], size: number, random: RandomSource): string[] {
  if (ids.length === 0 || size <= 0) return [];
  const plan: string[] = [];
  while (plan.length < size) plan.push(...shuffle(ids, random));
  return plan.slice(0, size);
}

export class QuizSessionService {
  private settings!: QuizSettings;
  private session: QuizSession | null = null;
  private bookId = '';
  private mode: QuizMode = 'mixed';
  private scope: PracticeScope = { kind: 'book' };
  private plan: string[] = [];
  private current: QuizCurrent | null = null;
  private prefetch: { position: number; promise: Promise<QuizCurrent | null> } | null = null;
  private status: QuizStatus = 'idle';
  private lastGrade: Grade | null = null;
  private answered = 0;
  private correct = 0;
  private streak = 0;
  private bestStreak = 0;
  private durationMs = 0;
  private missedIds = new Set<string>();
  private excluded = new Set<string>();
  private skippedAudio = 0;
  private skippedImages = 0;
  private shownAt = 0;
  private deadlineAt = 0;
  private pausedAt: number | null = null;
  private busy = false;

  constructor(private readonly deps: QuizSessionDeps) {}

  private get timed(): boolean {
    return this.mode === 'timed';
  }

  async start(request: QuizRequest): Promise<QuizView> {
    this.settings = await this.deps.settings.load();
    this.reset(request.bookId, request.mode, request.scope);
    const ids = await this.deps.resolver.resolve(request.bookId, request.scope);
    const seed = Math.floor(this.deps.seedSource.next() * 2 ** 32);
    const size = this.timed ? ids.length : (request.count ?? this.settings.quizQuestionCount);
    this.plan = buildPlan(ids, size, this.deps.createRandom(seed));
    const now = this.deps.clock.now().getTime();
    this.session = {
      id: `${now.toString(36)}-${seed.toString(36)}`,
      mode: request.mode,
      scope: request.scope,
      startedAt: now,
      finishedAt: null,
      totalQuestions: this.timed ? 0 : this.plan.length,
      correctCount: 0,
      durationMs: 0,
      seed,
    };
    if (this.plan.length === 0) {
      this.status = 'finished';
      return this.view();
    }
    this.deadlineAt = now + this.settings.timedChallengeSeconds * 1000;
    await this.deps.sessions.put(this.session);
    await this.persist(0);
    return this.presentFrom(0);
  }

  /** Restores an interrupted session; returns null when there is nothing to restore. */
  async resume(bookId: string): Promise<QuizView | null> {
    const saved = await this.deps.state.get<PersistedQuiz | null>(SettingKey.quizSession, null);
    if (!saved || saved.bookId !== bookId || saved.plan.length === 0) return null;
    this.settings = await this.deps.settings.load();
    this.reset(saved.bookId, saved.mode, saved.scope);
    this.plan = [...saved.plan];
    this.answered = saved.answered;
    this.correct = saved.correct;
    this.streak = saved.streak;
    this.bestStreak = saved.bestStreak;
    this.durationMs = saved.durationMs;
    this.missedIds = new Set(saved.missedIds);
    this.excluded = new Set(saved.excluded);
    this.skippedAudio = saved.skippedAudio;
    this.skippedImages = saved.skippedImages;
    // A timed run continues with the time that was left at the last answer.
    this.deadlineAt = this.deps.clock.now().getTime() + (saved.remainingMs ?? 0);
    this.session = {
      id: saved.sessionId,
      mode: saved.mode,
      scope: saved.scope,
      startedAt: saved.startedAt,
      finishedAt: null,
      totalQuestions: saved.mode === 'timed' ? 0 : saved.plan.length,
      correctCount: saved.correct,
      durationMs: saved.durationMs,
      seed: saved.seed,
    };
    return this.presentFrom(saved.position);
  }

  async answer(input: string): Promise<QuizView> {
    const current = this.current;
    if (this.status !== 'question' || !current) return this.view();
    const grade = this.deps.factory.grade(current.question, input, { typoTolerance: this.settings.typoTolerance });
    return this.record(current, grade);
  }

  async skip(): Promise<QuizView> {
    const current = this.current;
    if (this.status !== 'question' || !current) return this.view();
    return this.record(current, gradeOutcome('wrong', current.question.answerLabel));
  }

  async next(): Promise<QuizView> {
    const current = this.current;
    if (this.status !== 'feedback' || !current) return this.view();
    if (this.timed && (this.remainingMs() ?? 0) <= 0) return this.finish();
    return this.presentFrom(current.position + 1);
  }

  pause(): void {
    if (this.pausedAt === null && (this.status === 'question' || this.status === 'feedback')) {
      this.pausedAt = this.deps.clock.now().getTime();
    }
  }

  resumeTimer(): void {
    if (this.pausedAt === null) return;
    const paused = this.deps.clock.now().getTime() - this.pausedAt;
    this.deadlineAt += paused;
    this.shownAt += paused;
    this.pausedAt = null;
  }

  remainingMs(): number | null {
    if (!this.timed) return null;
    const reference = this.pausedAt ?? this.deps.clock.now().getTime();
    return Math.max(0, this.deadlineAt - reference);
  }

  /** Called by the UI timer; ends a timed run when the clock reaches zero. */
  async expireIfNeeded(): Promise<QuizView | null> {
    if (!this.timed || this.status === 'finished' || this.pausedAt !== null) return null;
    return (this.remainingMs() ?? 1) <= 0 ? this.finish() : null;
  }

  async summary(): Promise<QuizSummary> {
    const missed = await this.deps.words.getMany([...this.missedIds]);
    return {
      total: this.answered,
      correct: this.correct,
      accuracy: this.answered === 0 ? 0 : this.correct / this.answered,
      durationMs: this.durationMs,
      bestStreak: this.bestStreak,
      missed,
      skippedAudio: this.skippedAudio,
      skippedImages: this.skippedImages,
    };
  }

  view(): QuizView {
    return {
      status: this.status,
      current: this.current,
      grade: this.lastGrade,
      mode: this.session ? this.mode : null,
      answered: this.answered,
      total: this.timed ? null : this.plan.length,
      correct: this.correct,
      streak: this.streak,
      bestStreak: this.bestStreak,
      paused: this.pausedAt !== null,
      timed: this.timed,
      empty: this.session !== null && this.plan.length === 0,
      remainingMs: this.remainingMs(),
      showHints: this.settings?.showHints ?? true,
      autoPlayAudio: this.settings?.quizAutoPlayAudio ?? true,
      autoAdvance: this.settings?.quizAutoAdvance ?? true,
    };
  }

  private reset(bookId: string, mode: QuizMode, scope: PracticeScope): void {
    this.bookId = bookId;
    this.mode = mode;
    this.scope = scope;
    this.current = null;
    this.prefetch = null;
    this.status = 'idle';
    this.lastGrade = null;
    this.answered = 0;
    this.correct = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.durationMs = 0;
    this.missedIds = new Set();
    this.excluded = new Set();
    this.skippedAudio = 0;
    this.skippedImages = 0;
    this.pausedAt = null;
  }

  private async record(current: QuizCurrent, grade: Grade): Promise<QuizView> {
    const session = this.session;
    if (!session || this.busy) return this.view();
    this.busy = true;
    try {
      const now = this.deps.clock.now().getTime();
      const log: QuizAnswerLog = {
        sessionId: session.id,
        wordId: current.question.wordId,
        questionType: current.question.type,
        correct: grade.correct,
        almost: grade.almost,
        answeredAt: now,
        durationMs: Math.min(MAX_ANSWER_MS, Math.max(0, now - this.shownAt)),
      };
      await this.deps.ledger.recordAnswer({ log, practicingMistakes: this.mode === 'mistakes' });

      this.answered += 1;
      this.durationMs += log.durationMs;
      if (grade.correct) {
        this.correct += 1;
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
      } else {
        this.streak = 0;
        this.missedIds.add(current.question.wordId);
      }
      this.lastGrade = grade;
      this.status = 'feedback';
      await this.persist(current.position + 1);
      return this.view();
    } finally {
      this.busy = false;
    }
  }

  private async presentFrom(position: number): Promise<QuizView> {
    const pending = this.prefetch?.position === position ? this.prefetch.promise : this.buildFrom(position);
    this.prefetch = null;
    const next = await pending;
    if (!next) return this.finish();
    this.current = next;
    this.lastGrade = null;
    this.status = 'question';
    this.shownAt = this.deps.clock.now().getTime();
    // Build the following question while the player answers this one, so its media is ready.
    const upcoming = next.position + 1;
    this.prefetch = { position: upcoming, promise: this.buildFrom(upcoming).catch(() => null) };
    return this.view();
  }

  private async buildFrom(position: number): Promise<QuizCurrent | null> {
    const attempts = this.plan.length;
    for (let step = 0; step < attempts; step += 1) {
      const at = position + step;
      if (!this.timed && at >= this.plan.length) return null;
      const wordId = this.plan[at % this.plan.length];
      const word = wordId ? await this.deps.words.get(wordId) : undefined;
      if (!word) continue;
      const built = await this.tryWord(word, at);
      if (built) return built;
    }
    return null;
  }

  private async tryWord(word: Word, position: number): Promise<QuizCurrent | null> {
    const random = this.deps.createRandom(mixSeed(this.session?.seed ?? 0, position));
    const candidates = shuffle(
      MODE_TYPES[this.mode].filter((type) => this.deps.factory.canCreate(type, word) && !this.excluded.has(`${type}:${word.id}`)),
      random,
    );
    for (const type of candidates) {
      if (!(await this.mediaReady(word, type))) continue;
      try {
        const question = await this.deps.factory.create(type, word, {
          selector: this.deps.createSelector(random),
          random,
          optionCount: this.settings.quizOptionCount,
        });
        return { question, target: word, related: await this.relatedWords(question, word), position };
      } catch (error) {
        if (!(error instanceof DistractorPoolTooSmallError)) throw error;
      }
    }
    return null;
  }

  private async mediaReady(word: Word, type: QuestionType): Promise<boolean> {
    const needsAudio = type === 'dictation';
    const needsImage = type === 'mcq-image-to-word' || type === 'mcq-word-to-image';
    if (!needsAudio && !needsImage) return true;
    const available = needsAudio ? await this.deps.media.isAudioAvailable(word) : await this.deps.media.isImageAvailable(word);
    if (available) return true;
    this.excluded.add(`${type}:${word.id}`);
    if (needsAudio) this.skippedAudio += 1;
    else this.skippedImages += 1;
    return false;
  }

  private async relatedWords(question: Question, target: Word): Promise<ReadonlyMap<string, Word>> {
    const ids = new Set<string>();
    if ('options' in question) {
      for (const option of question.options) if (option.imageWordId && option.imageWordId !== target.id) ids.add(option.imageWordId);
    }
    const related = new Map<string, Word>([[target.id, target]]);
    if (ids.size > 0) for (const word of await this.deps.words.getMany([...ids])) related.set(word.id, word);
    return related;
  }

  private async finish(): Promise<QuizView> {
    this.status = 'finished';
    this.current = null;
    this.prefetch = null;
    const session = this.session;
    if (session) {
      await this.deps.sessions.put({
        ...session,
        finishedAt: this.deps.clock.now().getTime(),
        totalQuestions: this.answered,
        correctCount: this.correct,
        durationMs: this.durationMs,
      });
    }
    await this.deps.state.set(SettingKey.quizSession, null);
    return this.view();
  }

  /** Saved after every answer so a refresh resumes at the next question. */
  private async persist(position: number): Promise<void> {
    const session = this.session;
    if (!session) return;
    const value: PersistedQuiz = {
      sessionId: session.id,
      bookId: this.bookId,
      mode: this.mode,
      scope: this.scope,
      seed: session.seed,
      plan: this.plan,
      position,
      startedAt: session.startedAt,
      answered: this.answered,
      correct: this.correct,
      streak: this.streak,
      bestStreak: this.bestStreak,
      missedIds: [...this.missedIds],
      durationMs: this.durationMs,
      skippedAudio: this.skippedAudio,
      skippedImages: this.skippedImages,
      excluded: [...this.excluded],
      remainingMs: this.remainingMs(),
    };
    await this.deps.state.set(SettingKey.quizSession, value);
  }
}
