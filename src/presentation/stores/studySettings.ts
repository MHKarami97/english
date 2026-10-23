import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import { DEFAULT_STUDY_SETTINGS, type StudySettings } from '@/domain/study/models';

export const useStudySettingsStore = defineStore('studySettings', () => {
  const settings = shallowRef<StudySettings>(DEFAULT_STUDY_SETTINGS);

  async function load(): Promise<void> {
    settings.value = await container.studySettings.load();
  }

  async function update(change: Partial<StudySettings>): Promise<StudySettings> {
    settings.value = await container.studySettings.update(change);
    return settings.value;
  }

  return { settings, load, update };
});
