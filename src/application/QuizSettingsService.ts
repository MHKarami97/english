import type { SettingsRepository } from '@/domain/contracts';
import { sanitizeQuizSettings, type QuizSettings } from '@/domain/quiz/models';
import { SettingKey } from './settingKeys';

export class QuizSettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  async load(): Promise<QuizSettings> {
    return sanitizeQuizSettings(await this.settings.get<Record<string, unknown>>(SettingKey.quizSettings, {}));
  }

  async update(change: Partial<QuizSettings>): Promise<QuizSettings> {
    const next = sanitizeQuizSettings({ ...(await this.load()), ...change });
    await this.settings.set(SettingKey.quizSettings, next);
    return next;
  }
}
