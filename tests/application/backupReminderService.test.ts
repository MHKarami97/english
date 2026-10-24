import { describe, expect, it } from 'vitest';
import { BackupReminderService } from '@/application/BackupReminderService';
import { SettingKey } from '@/application/settingKeys';
import type { SettingsRepository } from '@/domain/contracts';

const DAY = 24 * 60 * 60 * 1000;

class MemorySettings implements SettingsRepository {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string, fallback: T): Promise<T> {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

describe('BackupReminderService', () => {
  it('stays quiet without review history', async () => {
    const service = new BackupReminderService(new MemorySettings(), { firstReviewAt: async () => null }, () => 100 * DAY);
    expect(await service.isDue()).toBe(false);
  });

  it('is due after two weeks and quiet again after an export, until two more weeks pass', async () => {
    let now = 20 * DAY;
    const settings = new MemorySettings();
    const service = new BackupReminderService(settings, { firstReviewAt: async () => 0 }, () => now);
    expect(await service.isDue()).toBe(true);

    await service.markExported();
    expect(settings.values.get(SettingKey.lastExportAt)).toBe(20 * DAY);
    expect(await service.isDue()).toBe(false);

    now = 33 * DAY;
    expect(await service.isDue()).toBe(false);
    now = 34 * DAY;
    expect(await service.isDue()).toBe(true);
  });

  it('goes quiet for two weeks after the user says later', async () => {
    let now = 20 * DAY;
    const settings = new MemorySettings();
    const service = new BackupReminderService(settings, { firstReviewAt: async () => 0 }, () => now);
    await service.dismiss();
    expect(settings.values.get(SettingKey.backupReminderDismissedAt)).toBe(20 * DAY);
    expect(await service.isDue()).toBe(false);
    now = 34 * DAY;
    expect(await service.isDue()).toBe(true);
  });
});
