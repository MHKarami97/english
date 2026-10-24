<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleAlert, CircleCheck, CircleX, Volume2 } from '@lucide/vue';
import type { Word } from '@/domain/entities';
import type { Grade } from '@/domain/quiz/grading';
import ExampleSentence from './ExampleSentence.vue';

const props = defineProps<{ grade: Grade; target: Word; autoAdvance: boolean }>();
const emit = defineEmits<{ next: []; play: [] }>();
const { t } = useI18n();
const headline = computed(() => t(`quiz.feedback.${props.grade.outcome}`));
const tone = computed(() => (props.grade.outcome === 'wrong' ? 'border-unknown' : props.grade.outcome === 'correct' ? 'border-known' : 'border-fav'));
</script>

<template>
  <div class="card mt-4 border-2 p-4" :class="tone" role="status" aria-live="polite">
    <p class="flex items-center gap-2 font-medium">
      <CircleCheck v-if="grade.outcome === 'correct'" class="size-5 text-known" aria-hidden="true" />
      <CircleAlert v-else-if="grade.almost" class="size-5 text-fav" aria-hidden="true" />
      <CircleX v-else class="size-5 text-unknown" aria-hidden="true" />
      {{ headline }}
    </p>
    <p v-if="grade.outcome !== 'correct'" class="mt-2">{{ t('quiz.feedback.answerIs') }} <bdi lang="en" dir="ltr"><strong class="font-semibold">{{ grade.expected }}</strong></bdi>.</p>
    <ExampleSentence class="mt-3 text-muted" :segments="target.exampleSegments" />
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" class="btn" @click="emit('play')"><Volume2 class="size-5" aria-hidden="true" /> {{ t('quiz.feedback.play') }}</button>
      <button type="button" class="btn btn-primary" @click="emit('next')">{{ t('quiz.feedback.next') }}</button>
      <span class="text-sm text-muted">{{ t('quiz.feedback.pressEnter') }}<template v-if="autoAdvance && grade.correct">{{ t('quiz.feedback.orWait') }}</template></span>
    </div>
  </div>
</template>
