import type { SettingsRepository } from '@/domain/contracts';
import { sanitizeStudySettings, type StudySettings } from '@/domain/study/models';
import { SettingKey } from './settingKeys';

export class StudySettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  async load(): Promise<StudySettings> {
    const stored = await this.settings.get<Record<string, unknown>>(SettingKey.studySettings, {});
    return sanitizeStudySettings(stored);
  }

  /** Every write goes through sanitizeStudySettings, so the stored value is always in range. */
  async update(change: Partial<StudySettings>): Promise<StudySettings> {
    const next = sanitizeStudySettings({ ...(await this.load()), ...change });
    await this.settings.set(SettingKey.studySettings, next);
    return next;
  }
}
