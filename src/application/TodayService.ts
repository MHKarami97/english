import type { StreakResult } from '@/domain/study/StreakCalculator';
import { emptyDailyStats } from '@/domain/study/models';
import type { DailyStatsRepository, ReviewLogRepository } from '@/domain/study/ports';
import type { QueueBuilder } from './QueueBuilder';
import type { StreakService } from './StreakService';
import type { StudyDayService } from './StudyDayService';
import type { StudySettingsService } from './StudySettingsService';

export interface DayActivity {
  readonly dateKey: string;
  readonly count: number;
}

export interface TodaySummary {
  readonly newAvailable: number;
  readonly reviewsPlanned: number;
  readonly dueTotal: number;
  readonly plannedTotal: number;
  readonly studiedToday: number;
  readonly averageSeconds: number;
  readonly estimatedSeconds: number;
  readonly streak: StreakResult;
  readonly week: readonly DayActivity[];
}

export const DEFAULT_SECONDS_PER_CARD = 8;
const DURATION_SAMPLE = 200;
const MAX_PLAUSIBLE_ANSWER_MS = 120_000;

export class TodayService {
  constructor(
    private readonly settings: StudySettingsService,
    private readonly studyDay: StudyDayService,
    private readonly queue: QueueBuilder,
    private readonly stats: DailyStatsRepository,
    private readonly logs: ReviewLogRepository,
    private readonly streak: StreakService,
  ) {}

  async summary(bookId: string): Promise<TodaySummary> {
    const settings = await this.settings.load();
    const rollover = settings.dayRolloverHour;
    const calendar = this.studyDay.calendar(rollover);
    const todayKey = this.studyDay.todayKey(rollover);

    const [todayStats, recent, streak, week] = await Promise.all([
      this.stats.get(todayKey),
      this.logs.recent(DURATION_SAMPLE),
      this.streak.current(rollover),
      this.stats.range(calendar.addDays(todayKey, -6), todayKey),
    ]);
    const stats = todayStats ?? emptyDailyStats(todayKey);
    const plan = await this.queue.build({
      bookId,
      settings,
      todayStats: stats,
      dueBefore: this.studyDay.endOfToday(rollover),
    });

    const durations = recent.map((log) => log.durationMs).filter((ms) => ms > 0 && ms < MAX_PLAUSIBLE_ANSWER_MS);
    const averageSeconds = durations.length
      ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 1000
      : DEFAULT_SECONDS_PER_CARD;

    const countByDay = new Map(week.map((day) => [day.dateKey, day.newCount + day.reviewCount]));
    return {
      newAvailable: plan.newCount,
      reviewsPlanned: plan.reviewCount,
      dueTotal: plan.dueTotal,
      plannedTotal: plan.entries.length,
      studiedToday: stats.newCount + stats.reviewCount,
      averageSeconds,
      estimatedSeconds: Math.round(plan.entries.length * averageSeconds),
      streak,
      week: Array.from({ length: 7 }, (_, offset) => {
        const dateKey = calendar.addDays(todayKey, offset - 6);
        return { dateKey, count: countByDay.get(dateKey) ?? 0 };
      }),
    };
  }
}
