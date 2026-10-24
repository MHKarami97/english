<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { QUIZ_SETTING_LIMITS, type QuizSettings } from '@/domain/quiz/models';
import { useQuizSettingsStore } from '@/presentation/stores/quizSettings';

type NumericKey = 'quizQuestionCount' | 'quizOptionCount' | 'timedChallengeSeconds';
type ToggleKey = 'typoTolerance' | 'showHints' | 'quizAutoPlayAudio' | 'quizAutoAdvance';

const { t } = useI18n();
const quiz = useQuizSettingsStore();
const limits = QUIZ_SETTING_LIMITS;

const numbers: readonly NumericKey[] = ['quizQuestionCount', 'quizOptionCount', 'timedChallengeSeconds'];
const toggles: readonly ToggleKey[] = ['typoTolerance', 'showHints', 'quizAutoPlayAudio', 'quizAutoAdvance'];

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
    <h2 id="practice-settings-title" class="mb-3 font-display text-xl font-semibold">{{ t('practice.title') }}</h2>
    <div class="grid gap-4 sm:grid-cols-3">
      <label v-for="key in numbers" :key="key" class="text-sm">
        <span class="text-muted">{{ t('practiceSettings.range', { label: t(`practiceSettings.numbers.${key}`), min: limits[key].min, max: limits[key].max }) }}</span>
        <input type="number" inputmode="numeric" dir="ltr" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px]" :min="limits[key].min" :max="limits[key].max" :value="quiz.settings[key]" @change="setNumber(key, $event)" />
      </label>
    </div>
    <div v-for="key in toggles" :key="key" class="mt-4 flex items-center justify-between gap-4">
      <p :id="`practice-${key}`" class="text-sm">{{ t(`practiceSettings.toggles.${key}`) }}</p>
      <input type="checkbox" role="switch" class="size-6 accent-[var(--accent)]" :aria-labelledby="`practice-${key}`" :checked="quiz.settings[key]" @change="setToggle(key, $event)" />
    </div>
  </section>
</template>
