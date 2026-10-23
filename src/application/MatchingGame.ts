import type { WordRepository } from '@/domain/contracts';
import type { Word } from '@/domain/entities';
import { MATCHING_PAIRS_PER_ROUND, buildMatchingRound } from '@/domain/quiz/matching';
import type { PracticeScope, QuizAnswerLog, QuizSession } from '@/domain/quiz/models';
import type { QuizLedger, QuizSessionRepository } from '@/domain/quiz/ports';
import type { MatchingQuestion } from '@/domain/quiz/questions';
import { shuffle, type RandomSource } from '@/domain/random';
import type { Clock } from '@/domain/scheduling/Clock';
import type { ScopeResolver } from './ScopeResolver';

export type MatchingStatus = 'idle' | 'playing' | 'round-complete' | 'finished';

export interface MatchingView {
  readonly status: MatchingStatus;
  readonly question: MatchingQuestion | null;
  readonly words: ReadonlyMap<string, Word>;
  readonly matched: ReadonlySet<string>;
  readonly round: number;
  readonly attempts: number;
  readonly wrongAttempts: number;
  readonly pairsMatched: number;
  readonly roundAttempts: number;
  readonly elapsedMs: number;
  readonly empty: boolean;
}

export interface MatchingDeps {
  readonly clock: Clock;
  readonly seedSource: RandomSource;
  readonly createRandom: (seed: number) => RandomSource;
  readonly resolver: ScopeResolver;
  readonly words: WordRepository;
  readonly ledger: QuizLedger;
  readonly sessions: QuizSessionRepository;
}

const LOOKAHEAD = 12;

/** Rounds of six pairs, drawn lazily from the scope so the whole book is never loaded as words. */
export class MatchingGame {
  private queue: string[] = [];
  private variant: MatchingQuestion['variant'] = 'definition';
  private random: RandomSource | null = null;
  private session: QuizSession | null = null;
  private question: MatchingQuestion | null = null;
  private words = new Map<string, Word>();
  private matched = new Set<string>();
  private status: MatchingStatus = 'idle';
  private round = 0;
  private attempts = 0;
  private wrongAttempts = 0;
  private roundAttempts = 0;
  private pairsMatched = 0;

  constructor(private readonly deps: MatchingDeps) {}

  async start(bookId: string, scope: PracticeScope, variant: MatchingQuestion['variant']): Promise<MatchingView> {
    this.variant = variant;
    this.round = 0;
    this.attempts = 0;
    this.wrongAttempts = 0;
    this.pairsMatched = 0;
    const seed = Math.floor(this.deps.seedSource.next() * 2 ** 32);
    this.random = this.deps.createRandom(seed);
    this.queue = shuffle(await this.deps.resolver.resolve(bookId, scope), this.random);
    const now = this.deps.clock.now().getTime();
    this.session = {
      id: `${now.toString(36)}-${seed.toString(36)}`,
      mode: 'matching',
      scope,
      startedAt: now,
      finishedAt: null,
      totalQuestions: 0,
      correctCount: 0,
      durationMs: 0,
      seed,
    };
    await this.deps.sessions.put(this.session);
    return this.nextRound();
  }

  async attempt(leftId: string, rightId: string): Promise<boolean> {
    const session = this.session;
    if (this.status !== 'playing' || !session || this.matched.has(leftId)) return false;
    const correct = leftId === rightId;
    this.attempts += 1;
    this.roundAttempts += 1;
    const log: QuizAnswerLog = {
      sessionId: session.id,
      wordId: leftId,
      questionType: 'matching',
      correct,
      almost: false,
      answeredAt: this.deps.clock.now().getTime(),
      durationMs: 0,
    };
    await this.deps.ledger.recordAnswer({ log, practicingMistakes: false });
    if (correct) {
      this.matched.add(leftId);
      this.pairsMatched += 1;
      if (this.question && this.matched.size === this.question.pairs.length) this.status = 'round-complete';
    } else {
      this.wrongAttempts += 1;
    }
    return correct;
  }

  async nextRound(): Promise<MatchingView> {
    const random = this.random;
    const round: Word[] = [];
    while (random && round.length < MATCHING_PAIRS_PER_ROUND && this.queue.length > 0) {
      const batch = await this.deps.words.getMany(this.queue.splice(0, LOOKAHEAD));
      for (const word of batch) {
        const usable = this.variant === 'image' ? word.image.length > 0 : word.definition.length > 0;
        if (usable && round.length < MATCHING_PAIRS_PER_ROUND) round.push(word);
      }
    }
    if (!random || round.length < 2) return this.finish();
    this.round += 1;
    this.words = new Map(round.map((word) => [word.id, word]));
    this.question = buildMatchingRound(`round-${this.round}`, round, this.variant, random);
    this.matched = new Set();
    this.roundAttempts = 0;
    this.status = 'playing';
    return this.view();
  }

  async finish(): Promise<MatchingView> {
    this.status = 'finished';
    const session = this.session;
    if (session) {
      const now = this.deps.clock.now().getTime();
      await this.deps.sessions.put({
        ...session,
        finishedAt: now,
        totalQuestions: this.attempts,
        correctCount: this.pairsMatched,
        durationMs: now - session.startedAt,
      });
    }
    return this.view();
  }

  view(): MatchingView {
    const started = this.session?.startedAt ?? 0;
    return {
      status: this.status,
      question: this.question,
      words: this.words,
      matched: this.matched,
      round: this.round,
      attempts: this.attempts,
      wrongAttempts: this.wrongAttempts,
      pairsMatched: this.pairsMatched,
      roundAttempts: this.roundAttempts,
      elapsedMs: started === 0 ? 0 : this.deps.clock.now().getTime() - started,
      empty: this.status === 'finished' && this.round === 0,
    };
  }
}
