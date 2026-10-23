import type { SettingsRepository } from '@/domain/contracts';
import type { PlacementResult } from '@/domain/quiz/models';
import type { MistakeRepository, PlacementRepository } from '@/domain/quiz/ports';
import { readSavedQuiz, type SavedQuizMeta } from './QuizSessionService';
import { SettingKey } from './settingKeys';

export interface PracticeHub {
  readonly mistakeCount: number;
  readonly placement: PlacementResult | null;
  readonly promptDismissed: boolean;
  readonly savedQuiz: SavedQuizMeta | null;
}

export class PracticeHubService {
  constructor(
    private readonly mistakes: MistakeRepository,
    private readonly placements: PlacementRepository,
    private readonly state: SettingsRepository,
  ) {}

  async load(bookId: string): Promise<PracticeHub> {
    const [mistakeCount, placement, promptDismissed, savedQuiz] = await Promise.all([
      this.mistakes.count(),
      this.placements.latest(bookId),
      this.state.get(SettingKey.placementPromptDismissed, false),
      readSavedQuiz(this.state, bookId),
    ]);
    return { mistakeCount, placement: placement ?? null, promptDismissed, savedQuiz };
  }

  dismissPlacementPrompt(): Promise<void> {
    return this.state.set(SettingKey.placementPromptDismissed, true);
  }
}
