import { BACKUP_REMINDER_DAYS } from '@/config/download';
import type { SettingsRepository } from '@/domain/contracts';
import { shouldRemindBackup } from '@/domain/backup/reminder';
import { SettingKey } from './settingKeys';

export interface HistoryProbe {
  firstReviewAt(): Promise<number | null>;
}

export class BackupReminderService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly history: HistoryProbe,
    private readonly now: () => number = Date.now,
  ) {}

  async isDue(): Promise<boolean> {
    const [firstReviewAt, lastExportAt, dismissedAt] = await Promise.all([
      this.history.firstReviewAt(),
      this.settings.get<number | null>(SettingKey.lastExportAt, null),
      this.settings.get<number | null>(SettingKey.backupReminderDismissedAt, null),
    ]);
    return shouldRemindBackup({ firstReviewAt, lastExportAt, dismissedAt, now: this.now(), days: BACKUP_REMINDER_DAYS });
  }

  dismiss(): Promise<void> {
    return this.settings.set(SettingKey.backupReminderDismissedAt, this.now());
  }

  markExported(): Promise<void> {
    return this.settings.set(SettingKey.lastExportAt, this.now());
  }
}
