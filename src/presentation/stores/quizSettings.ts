import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import { DEFAULT_QUIZ_SETTINGS, type QuizSettings } from '@/domain/quiz/models';

export const useQuizSettingsStore = defineStore('quizSettings', () => {
  const settings = shallowRef<QuizSettings>(DEFAULT_QUIZ_SETTINGS);

  async function load(): Promise<void> {
    settings.value = await container.quizSettings.load();
  }

  async function update(change: Partial<QuizSettings>): Promise<QuizSettings> {
    settings.value = await container.quizSettings.update(change);
    return settings.value;
  }

  return { settings, load, update };
});
