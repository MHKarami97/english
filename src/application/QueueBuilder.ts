import type { ProgressRepository, UnitRepository, WordRepository } from '@/domain/contracts';
import { shuffle, type RandomSource } from '@/domain/random';
import type { DailyStats, StudySettings } from '@/domain/study/models';
import type { ReviewCardRepository } from '@/domain/study/ports';

export interface QueueEntry {
  readonly wordId: string;
  readonly kind: 'review' | 'new';
  /** In-session repeat of a card that was answered Again (or Hard on a new card). */
  readonly drill?: boolean;
}

export interface QueueRequest {
  readonly bookId: string;
  readonly settings: StudySettings;
  readonly todayStats: DailyStats;
  /** Cards due strictly before this instant (the start of tomorrow's study day) are due today. */
  readonly dueBefore: number;
  /** New cards allowed on top of the daily limit ("study more"). */
  readonly extraNew?: number;
}

export interface QueuePlan {
  readonly entries: readonly QueueEntry[];
  readonly reviewCount: number;
  readonly newCount: number;
  /** All due cards, including those held back by the daily review limit. */
  readonly dueTotal: number;
}

// Orphan cards (their word vanished after a content re-import) are skipped, so fetch a few extra.
const ORPHAN_MARGIN = 20;

/**
 * New cards are spread evenly among the reviews: after step i exactly floor((i + 1) * new / total)
 * new cards have been shown. Reviews stay oldest-due first, and neither group is starved.
 */
export function interleave<T>(reviews: readonly T[], news: readonly T[]): T[] {
  const total = reviews.length + news.length;
  const merged: T[] = [];
  let reviewIndex = 0;
  let newIndex = 0;
  for (let step = 0; step < total; step += 1) {
    const expectedNew = Math.floor(((step + 1) * news.length) / total);
    const takeNew = newIndex < news.length && (newIndex < expectedNew || reviewIndex >= reviews.length);
    merged.push((takeNew ? news[newIndex++] : reviews[reviewIndex++]) as T);
  }
  return merged;
}

export class QueueBuilder {
  constructor(
    private readonly cards: ReviewCardRepository,
    private readonly units: UnitRepository,
    private readonly words: WordRepository,
    private readonly progress: ProgressRepository,
    private readonly random: RandomSource,
  ) {}

  async build(request: QueueRequest): Promise<QueuePlan> {
    const { bookId, settings, todayStats } = request;
    const reviewRoom = Math.max(0, settings.maxReviewsPerDay - todayStats.reviewCount);
    const newRoom = Math.max(0, settings.newPerDay - todayStats.newCount) + (request.extraNew ?? 0);

    const [reviews, dueTotal, news] = await Promise.all([
      this.collectReviews(bookId, request.dueBefore, reviewRoom),
      this.cards.countDue(bookId, request.dueBefore),
      this.collectNew(bookId, settings, newRoom),
    ]);
    return {
      entries: interleave(reviews, news),
      reviewCount: reviews.length,
      newCount: news.length,
      dueTotal,
    };
  }

  private async collectReviews(bookId: string, dueBefore: number, room: number): Promise<QueueEntry[]> {
    if (room === 0) return [];
    const due = await this.cards.listDue(bookId, dueBefore, room + ORPHAN_MARGIN);
    const existing = new Set((await this.words.getMany(due.map((card) => card.wordId))).map((word) => word.id));
    return due
      .filter((card) => existing.has(card.wordId))
      .slice(0, room)
      .map((card) => ({ wordId: card.wordId, kind: 'review' as const }));
  }

  private async collectNew(bookId: string, settings: StudySettings, room: number): Promise<QueueEntry[]> {
    if (room === 0) return [];
    const [allUnits, reviewedIds, knownIds] = await Promise.all([
      this.units.listByBook(bookId),
      this.cards.listWordIds(bookId),
      settings.skipKnownWords ? this.progress.listKnownIds(bookId) : Promise.resolve([] as readonly string[]),
    ]);
    const reviewed = new Set(reviewedIds);
    const known = new Set(knownIds);
    const active = settings.activeUnitIds ? new Set(settings.activeUnitIds) : null;
    const units = allUnits.filter((unit) => !active || active.has(unit.id));
    const isCandidate = (wordId: string): boolean => !reviewed.has(wordId) && !known.has(wordId);

    const picked: string[] = [];
    if (settings.newCardOrder === 'unit-order') {
      // Stops reading units as soon as the room is filled, so 4000 words are never loaded.
      for (const unit of units) {
        if (picked.length >= room) break;
        for (const word of await this.words.listByUnit(unit.id)) {
          if (isCandidate(word.id)) picked.push(word.id);
          if (picked.length >= room) break;
        }
      }
    } else {
      const candidates: string[] = [];
      for (const unit of units) {
        for (const word of await this.words.listByUnit(unit.id)) {
          if (isCandidate(word.id)) candidates.push(word.id);
        }
      }
      picked.push(...shuffle(candidates, this.random).slice(0, room));
    }
    return picked.map((wordId) => ({ wordId, kind: 'new' as const }));
  }
}
