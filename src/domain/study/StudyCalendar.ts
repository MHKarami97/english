/** Day-based scheduling: a "study day" starts at the rollover hour in the device time zone. */
export interface StudyCalendar {
  dayKey(timestamp: number): string;
  startOfDay(dayKey: string): number;
  addDays(dayKey: string, days: number): string;
  /** Start of the study day that is `days` after the study day containing `from`. */
  dueAt(from: number, days: number): number;
}
