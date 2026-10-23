<script setup lang="ts">
import { onMounted } from 'vue';
import { QUIZ_SETTING_LIMITS, type QuizSettings } from '@/domain/quiz/models';
import { useQuizSettingsStore } from '@/presentation/stores/quizSettings';

type NumericKey = 'quizQuestionCount' | 'quizOptionCount' | 'timedChallengeSeconds';
type ToggleKey = 'typoTolerance' | 'showHints' | 'quizAutoPlayAudio' | 'quizAutoAdvance';

const quiz = useQuizSettingsStore();
const limits = QUIZ_SETTING_LIMITS;

const numbers: readonly { key: NumericKey; label: string }[] = [
  { key: 'quizQuestionCount', label: 'Questions per practice' },
  { key: 'quizOptionCount', label: 'Answer options' },
  { key: 'timedChallengeSeconds', label: 'Timed challenge (seconds)' },
];
const toggles: readonly { key: ToggleKey; label: string }[] = [
  { key: 'typoTolerance', label: 'Accept one-letter typos in typed answers' },
  { key: 'showHints', label: 'Show hints (meaning, letter count)' },
  { key: 'quizAutoPlayAudio', label: 'Play audio automatically in dictation' },
  { key: 'quizAutoAdvance', label: 'Move on automatically after a correct answer' },
];

onMounted(() => quiz.load());

async function setNumber(key: NumericKey, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const next: QuizSettings = await quiz.update({ [key]: Number(input.value) });
  input.value = String(next[key]);
}

async function setToggle(key: ToggleKey, event: Event): Promise<void> {
  await quiz.update({ [key]: (event.target as HTMLInputElement).checked });
}
</script>

<template>
  <section class="mb-8" aria-labelledby="practice-settings-title">
    <h2 id="practice-settings-title" class="mb-3 font-display text-xl font-semibold">Practice</h2>
    <div class="grid gap-4 sm:grid-cols-3">
      <label v-for="field in numbers" :key="field.key" class="text-sm">
        <span class="text-muted">{{ field.label }} ({{ limits[field.key].min }}-{{ limits[field.key].max }})</span>
        <input type="number" inputmode="numeric" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px]" :min="limits[field.key].min" :max="limits[field.key].max" :value="quiz.settings[field.key]" @change="setNumber(field.key, $event)" />
      </label>
    </div>
    <div v-for="toggle in toggles" :key="toggle.key" class="mt-4 flex items-center justify-between gap-4">
      <p :id="`practice-${toggle.key}`" class="text-sm">{{ toggle.label }}</p>
      <input type="checkbox" role="switch" class="size-6 accent-[var(--accent)]" :aria-labelledby="`practice-${toggle.key}`" :checked="quiz.settings[toggle.key]" @change="setToggle(toggle.key, $event)" />
    </div>
  </section>
</template>
