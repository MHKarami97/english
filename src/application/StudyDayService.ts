import type { Clock } from '@/domain/scheduling/Clock';
import { ZonedStudyCalendar } from '@/domain/study/ZonedStudyCalendar';

/** Binds the injected clock and the device time zone to the pure study calendar. */
export class StudyDayService {
  constructor(
    private readonly clock: Clock,
    private readonly timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {}

  calendar(rolloverHour: number): ZonedStudyCalendar {
    return new ZonedStudyCalendar(this.timeZone, rolloverHour);
  }

  todayKey(rolloverHour: number): string {
    return this.calendar(rolloverHour).dayKey(this.clock.now().getTime());
  }

  /** First instant of tomorrow's study day; cards due before it are due today. */
  endOfToday(rolloverHour: number): number {
    const calendar = this.calendar(rolloverHour);
    return calendar.startOfDay(calendar.addDays(this.todayKey(rolloverHour), 1));
  }
}
