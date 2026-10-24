<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Volume2 } from '@lucide/vue';
import type { TypingQuestion } from '@/domain/quiz/questions';

defineProps<{ question: TypingQuestion; showHints: boolean; locked: boolean }>();
const emit = defineEmits<{ submit: [text: string]; play: [] }>();
const { t } = useI18n();
const answer = ref('');
const input = ref<HTMLInputElement | null>(null);
onMounted(() => input.value?.focus());
</script>

<template>
  <div>
    <div class="card p-5 text-center md:p-8">
      <template v-if="question.type === 'cloze-typing'">
        <p class="text-sm text-muted">{{ t('quiz.typeMissingWord') }}</p>
        <p class="mt-3 text-lead"><bdi lang="en" dir="ltr">{{ question.before }}</bdi><span class="mx-1 inline-block min-w-16 border-b-2 border-accent" aria-label="blank">&nbsp;</span><bdi lang="en" dir="ltr">{{ question.after }}</bdi></p>
        <p v-if="showHints" class="mt-3 text-sm text-muted">{{ t('quiz.meaning') }}: <bdi lang="en" dir="ltr">{{ question.hint }}</bdi></p>
      </template>
      <template v-else>
        <p class="text-sm text-muted">{{ t('quiz.listenAndType') }}</p>
        <button type="button" class="btn btn-primary mt-4 min-h-14 px-6" @click="emit('play')"><Volume2 class="size-5" aria-hidden="true" /> {{ t('quiz.playWord') }}</button>
        <p v-if="showHints" class="mt-3 text-sm text-muted">{{ t('quiz.letters', question.answerLabel.length) }}</p>
      </template>
    </div>
    <form class="mt-4 flex gap-3" @submit.prevent="emit('submit', answer)">
      <label class="sr-only" for="typed-answer">{{ t('quiz.yourAnswer') }}</label>
      <input id="typed-answer" ref="input" v-model="answer" type="text" dir="ltr" class="min-h-14 min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-4 text-[16px]" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" :disabled="locked" />
      <button type="submit" class="btn btn-primary min-h-14 px-5" :disabled="locked || answer.trim().length === 0">{{ t('quiz.check') }}</button>
    </form>
  </div>
</template>
