import type { SettingsRepository } from '@/domain/contracts';
import type { ReviewCardRepository, ReviewLedger } from '@/domain/study/ports';
import { SettingKey } from './settingKeys';

export class ReviewResetService {
  constructor(
    private readonly cards: ReviewCardRepository,
    private readonly ledger: ReviewLedger,
    private readonly settings: SettingsRepository,
  ) {}

  /** Forgets the schedule of one unit; its history in logs and daily statistics is kept. */
  async resetUnit(unitId: string): Promise<number> {
    const removed = await this.cards.removeByUnit(unitId);
    await this.settings.set(SettingKey.studySession, null);
    return removed;
  }

  async resetAll(): Promise<void> {
    await this.ledger.resetAll();
    await this.settings.set(SettingKey.studySession, null);
  }
}
