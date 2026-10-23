const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminderInput {
  /** Time of the oldest review, or null when there is no review history. */
  readonly firstReviewAt: number | null;
  readonly lastExportAt: number | null;
  readonly dismissedAt: number | null;
  readonly now: number;
  readonly days: number;
}

/** Remind once `days` have passed since the latest of: first review, last export, last dismissal. */
export function shouldRemindBackup(input: BackupReminderInput): boolean {
  if (input.firstReviewAt === null) return false;
  const reference = Math.max(input.firstReviewAt, input.lastExportAt ?? 0, input.dismissedAt ?? 0);
  return input.now - reference >= input.days * DAY_MS;
}
