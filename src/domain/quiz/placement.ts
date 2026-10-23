import { shuffle, type RandomSource } from '../random';

export type Confidence = 'low' | 'medium' | 'high';

export interface PlacementUnit {
  readonly id: string;
  readonly order: number;
}

export interface PlacementUnitResult {
  readonly unitId: string;
  readonly asked: number;
  readonly correct: number;
}

export interface PlacementOutcome {
  readonly estimatedStartUnitId: string | null;
  readonly perUnitAccuracy: Readonly<Record<string, number>>;
  readonly confidence: Confidence;
  readonly answered: number;
  /** Every unit passed, so the estimate is simply the last unit. */
  readonly allPassed: boolean;
}

export interface PlacementOptions {
  readonly wordsPerUnit: number;
  readonly threshold: number;
}

export const DEFAULT_PLACEMENT_OPTIONS: PlacementOptions = { wordsPerUnit: 4, threshold: 0.5 };

const accuracy = (...results: readonly PlacementUnitResult[]): number => {
  const asked = results.reduce((sum, result) => sum + result.asked, 0);
  return asked === 0 ? 1 : results.reduce((sum, result) => sum + result.correct, 0) / asked;
};

/**
 * Rough estimate, not a test of ability. A few questions per unit are asked in book order; the run
 * stops once two consecutive units together score below the threshold. With 4 questions a unit,
 * one lucky guess or slip moves a unit's accuracy by 25 points, which is why confidence stays low
 * until about 30 answers.
 */
export class PlacementPlanner {
  constructor(
    private readonly random: RandomSource,
    private readonly options: PlacementOptions = DEFAULT_PLACEMENT_OPTIONS,
  ) {}

  sampleWords(wordIds: readonly string[]): string[] {
    return shuffle(wordIds, this.random).slice(0, this.options.wordsPerUnit);
  }

  shouldStop(results: readonly PlacementUnitResult[]): boolean {
    const last = results.at(-1);
    const previous = results.at(-2);
    return last !== undefined && previous !== undefined && accuracy(previous, last) < this.options.threshold;
  }

  summarize(units: readonly PlacementUnit[], results: readonly PlacementUnitResult[]): PlacementOutcome {
    const ordered = [...units].sort((a, b) => a.order - b.order);
    const byUnit = new Map(results.map((result) => [result.unitId, result]));
    const evaluated = ordered.map((unit) => byUnit.get(unit.id)).filter((result): result is PlacementUnitResult => result !== undefined);

    let start: string | null = null;
    for (let index = 0; index < evaluated.length && start === null; index += 1) {
      const first = evaluated[index];
      if (!first) continue;
      const second = evaluated[index + 1];
      const failing = accuracy(...(second ? [first, second] : [first])) < this.options.threshold;
      if (failing) start = first.unitId;
    }

    const answered = results.reduce((sum, result) => sum + result.asked, 0);
    return {
      estimatedStartUnitId: start ?? ordered.at(-1)?.id ?? null,
      perUnitAccuracy: Object.fromEntries(evaluated.map((result) => [result.unitId, accuracy(result)])),
      confidence: answered < 12 ? 'low' : answered < 30 ? 'medium' : 'high',
      answered,
      allPassed: start === null,
    };
  }
}
