import type { DailyStatsRepository } from '@/domain/study/ports';
import { calculateStreaks, type StreakResult } from '@/domain/study/StreakCalculator';
import type { StudyDayService } from './StudyDayService';

export class StreakService {
  constructor(
    private readonly stats: DailyStatsRepository,
    private readonly studyDay: StudyDayService,
  ) {}

  async current(rolloverHour: number): Promise<StreakResult> {
    const all = await this.stats.listAll();
    const activeDays = all.filter((day) => day.newCount + day.reviewCount > 0).map((day) => day.dateKey);
    return calculateStreaks(activeDays, this.studyDay.todayKey(rolloverHour));
  }
}
