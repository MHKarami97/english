import type { ProgressRepository } from '@/domain/contracts';
import type { MistakeRepository, WordQueries } from '@/domain/quiz/ports';
import type { PracticeScope } from '@/domain/quiz/models';
import type { ReviewCardRepository } from '@/domain/study/ports';
import type { StudyDayService } from './StudyDayService';
import type { StudySettingsService } from './StudySettingsService';

const SCOPE_LIMIT = 1000;

/** Turns a practice scope into word ids with indexed, id-only queries. The review cards are only read. */
export class ScopeResolver {
  constructor(
    private readonly queries: WordQueries,
    private readonly progress: ProgressRepository,
    private readonly cards: ReviewCardRepository,
    private readonly mistakes: MistakeRepository,
    private readonly studyDay: StudyDayService,
    private readonly studySettings: StudySettingsService,
  ) {}

  async resolve(bookId: string, scope: PracticeScope): Promise<readonly string[]> {
    switch (scope.kind) {
      case 'units':
        return (await Promise.all(scope.unitIds.map((unitId) => this.queries.idsByUnit(unitId)))).flat();
      case 'book':
        return this.queries.idsByBook(bookId);
      case 'favorites':
        return this.progress.listFavoriteIds(bookId);
      case 'unknown':
        return this.queries.idsByKnowledge(bookId, 'unknown');
      case 'mistakes':
        return this.mistakes.wordIds(SCOPE_LIMIT);
      case 'due': {
        const { dayRolloverHour } = await this.studySettings.load();
        const due = await this.cards.listDue(bookId, this.studyDay.endOfToday(dayRolloverHour), SCOPE_LIMIT);
        return due.map((card) => card.wordId);
      }
    }
  }
}
