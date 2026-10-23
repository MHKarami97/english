import type { SettingsRepository, UnitRepository, WordRepository } from '@/domain/contracts';
import type { Unit, Word } from '@/domain/entities';
import type { DistractorSelector } from '@/domain/quiz/distractors';
import type { PlacementResult } from '@/domain/quiz/models';
import {
  PlacementPlanner,
  type PlacementOutcome,
  type PlacementUnitResult,
} from '@/domain/quiz/placement';
import type { KnownMarker, KnownSnapshot, PlacementRepository, WordQueries } from '@/domain/quiz/ports';
import type { McqDefinitionToWord } from '@/domain/quiz/questions';
import type { QuestionFactory } from '@/domain/quiz/strategies';
import type { RandomSource } from '@/domain/random';
import type { Clock } from '@/domain/scheduling/Clock';
import { SettingKey } from './settingKeys';
import type { StudySettingsService } from './StudySettingsService';

export interface PlacementView {
  readonly status: 'idle' | 'question' | 'finished';
  readonly question: McqDefinitionToWord | null;
  readonly target: Word | null;
  readonly unitTitle: string;
  readonly unitNumber: number;
  readonly unitCount: number;
  readonly answered: number;
  readonly outcome: PlacementOutcome | null;
  readonly empty: boolean;
}

export interface PlacementPreview {
  readonly startUnit: Unit | null;
  readonly activeUnitCount: number;
  readonly earlierWordCount: number;
  readonly wordsToMarkKnown: number;
}

export interface PlacementApplied {
  readonly activeUnitCount: number;
  readonly markedWords: number;
}

interface UndoRecord {
  readonly previousActiveUnitIds: readonly string[] | null;
  readonly snapshot: KnownSnapshot;
}

export interface PlacementDeps {
  readonly clock: Clock;
  readonly seedSource: RandomSource;
  readonly createRandom: (seed: number) => RandomSource;
  readonly createSelector: (random: RandomSource) => DistractorSelector;
  readonly factory: QuestionFactory;
  readonly units: UnitRepository;
  readonly words: WordRepository;
  readonly queries: WordQueries;
  readonly results: PlacementRepository;
  readonly studySettings: StudySettingsService;
  readonly marker: KnownMarker;
  readonly state: SettingsRepository;
}

/**
 * Questions are not written to the quiz logs or the mistakes queue: a placement test deliberately
 * asks about words the learner may not have met, and that would flood the queue.
 */
export class PlacementTestService {
  private bookId = '';
  private units: Unit[] = [];
  private unitIndex = -1;
  private queue: string[] = [];
  private askedInUnit = 0;
  private correctInUnit = 0;
  private results: PlacementUnitResult[] = [];
  private planner: PlacementPlanner | null = null;
  private random: RandomSource | null = null;
  private question: McqDefinitionToWord | null = null;
  private target: Word | null = null;
  private outcome: PlacementOutcome | null = null;
  private answered = 0;
  private finished = false;

  constructor(private readonly deps: PlacementDeps) {}

  async start(bookId: string): Promise<PlacementView> {
    this.bookId = bookId;
    this.units = [...(await this.deps.units.listByBook(bookId))];
    this.unitIndex = -1;
    this.queue = [];
    this.results = [];
    this.answered = 0;
    this.finished = false;
    this.outcome = null;
    const seed = Math.floor(this.deps.seedSource.next() * 2 ** 32);
    this.random = this.deps.createRandom(seed);
    this.planner = new PlacementPlanner(this.random);
    await this.advance();
    return this.view();
  }

  async answer(optionId: string): Promise<PlacementView> {
    const question = this.question;
    if (!question) return this.view();
    const grade = this.deps.factory.grade(question, optionId, { typoTolerance: false });
    this.askedInUnit += 1;
    this.answered += 1;
    if (grade.correct) this.correctInUnit += 1;
    await this.advance();
    return this.view();
  }

  view(): PlacementView {
    const unit = this.units[Math.max(0, this.unitIndex)];
    return {
      status: this.finished ? 'finished' : this.question ? 'question' : 'idle',
      question: this.question,
      target: this.target,
      unitTitle: unit?.title ?? '',
      unitNumber: Math.max(1, this.unitIndex + 1),
      unitCount: this.units.length,
      answered: this.answered,
      outcome: this.outcome,
      empty: this.finished && this.answered === 0,
    };
  }

  async preview(outcome: PlacementOutcome): Promise<PlacementPreview> {
    const startUnit = this.units.find((unit) => unit.id === outcome.estimatedStartUnitId) ?? null;
    const earlier = startUnit ? this.units.filter((unit) => unit.order < startUnit.order) : [];
    const earlierIds = (await Promise.all(earlier.map((unit) => this.deps.queries.idsByUnit(unit.id)))).flat();
    return {
      startUnit,
      activeUnitCount: startUnit ? this.units.filter((unit) => unit.order >= startUnit.order).length : 0,
      earlierWordCount: earlierIds.length,
      wordsToMarkKnown: await this.deps.marker.countToMarkKnown(earlierIds),
    };
  }

  /** Changes settings and word marks only when called, which the UI does after an explicit confirmation. */
  async apply(outcome: PlacementOutcome, markEarlierKnown: boolean): Promise<PlacementApplied> {
    const startUnit = this.units.find((unit) => unit.id === outcome.estimatedStartUnitId);
    if (!startUnit) return { activeUnitCount: 0, markedWords: 0 };

    const previous = await this.deps.studySettings.load();
    const active = this.units.filter((unit) => unit.order >= startUnit.order);
    await this.deps.studySettings.update({ activeUnitIds: active.length === this.units.length ? null : active.map((unit) => unit.id) });

    let snapshot: KnownSnapshot = { entries: [] };
    if (markEarlierKnown) {
      const earlier = this.units.filter((unit) => unit.order < startUnit.order);
      const ids = (await Promise.all(earlier.map((unit) => this.deps.queries.idsByUnit(unit.id)))).flat();
      snapshot = await this.deps.marker.markKnown(this.bookId, ids, this.deps.clock.now().getTime());
    }
    const record: UndoRecord = { previousActiveUnitIds: previous.activeUnitIds ? [...previous.activeUnitIds] : null, snapshot };
    await this.deps.state.set(SettingKey.placementUndo, record);
    return { activeUnitCount: active.length, markedWords: snapshot.entries.length };
  }

  async hasUndo(): Promise<boolean> {
    return (await this.deps.state.get<UndoRecord | null>(SettingKey.placementUndo, null)) !== null;
  }

  async undo(): Promise<boolean> {
    const record = await this.deps.state.get<UndoRecord | null>(SettingKey.placementUndo, null);
    if (!record) return false;
    await this.deps.marker.restore(record.snapshot);
    await this.deps.studySettings.update({ activeUnitIds: record.previousActiveUnitIds });
    await this.deps.state.set(SettingKey.placementUndo, null);
    return true;
  }

  private async advance(): Promise<void> {
    const planner = this.planner;
    const random = this.random;
    if (!planner || !random) return;
    for (;;) {
      if (this.queue.length === 0) {
        if (this.unitIndex >= 0 && this.askedInUnit > 0) {
          const unit = this.units[this.unitIndex];
          if (unit) this.results.push({ unitId: unit.id, asked: this.askedInUnit, correct: this.correctInUnit });
          if (planner.shouldStop(this.results)) return this.complete(planner);
        }
        this.unitIndex += 1;
        const unit = this.units[this.unitIndex];
        if (!unit) return this.complete(planner);
        this.queue = planner.sampleWords(await this.deps.queries.idsByUnit(unit.id));
        this.askedInUnit = 0;
        this.correctInUnit = 0;
        continue;
      }
      const wordId = this.queue.shift();
      const word = wordId ? await this.deps.words.get(wordId) : undefined;
      if (!word || !this.deps.factory.canCreate('mcq-definition-to-word', word)) continue;
      try {
        const question = await this.deps.factory.create('mcq-definition-to-word', word, {
          selector: this.deps.createSelector(random),
          random,
          optionCount: 4,
        });
        if (question.type === 'mcq-definition-to-word') {
          this.question = question;
          this.target = word;
          return;
        }
      } catch {
        // A word without enough distractors is simply not asked.
      }
    }
  }

  private async complete(planner: PlacementPlanner): Promise<void> {
    this.question = null;
    this.target = null;
    this.finished = true;
    this.outcome = planner.summarize(this.units, this.results);
    if (this.answered === 0) return;
    const takenAt = this.deps.clock.now().getTime();
    const result: PlacementResult = {
      id: `${this.bookId}-${takenAt.toString(36)}`,
      bookId: this.bookId,
      takenAt,
      estimatedStartUnitId: this.outcome.estimatedStartUnitId,
      perUnitAccuracy: this.outcome.perUnitAccuracy,
      confidence: this.outcome.confidence,
    };
    await this.deps.results.put(result);
  }
}
