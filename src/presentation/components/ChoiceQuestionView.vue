<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, X } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import type { ChoiceQuestion } from '@/domain/quiz/questions';
import MediaImage from './MediaImage.vue';

const props = defineProps<{ question: ChoiceQuestion; related: ReadonlyMap<string, Word>; selectedId: string | null; revealedId: string | null; showHints: boolean }>();
const emit = defineEmits<{ select: [optionId: string] }>();
const { t } = useI18n();
const locked = computed(() => props.revealedId !== null);
const imageOptions = computed(() => props.question.options.some((option) => option.imageWordId !== undefined));
const instruction = computed(() => t(`quiz.instructions.${props.question.type}`));
const imageFor = (wordId?: string): string | null => { const word = wordId ? props.related.get(wordId) : undefined; return word ? container.media.wordImage(word) : null; };
function stateOf(optionId: string): 'correct' | 'wrong' | 'selected' | 'idle' { if (props.revealedId !== null) { if (optionId === props.revealedId) return 'correct'; return optionId === props.selectedId ? 'wrong' : 'idle'; } return optionId === props.selectedId ? 'selected' : 'idle'; }
const stateClass = (optionId: string): string => ({ correct: 'border-known bg-known/10', wrong: 'border-unknown bg-unknown/10', selected: 'border-accent', idle: 'border-line hover:border-muted' })[stateOf(optionId)];
</script>

<template>
  <div>
    <div class="card p-5 text-center md:p-8">
      <p class="text-sm text-muted">{{ instruction }}</p>
      <p v-if="question.type === 'mcq-definition-to-word'" class="mt-3 text-lead"><bdi lang="en" dir="ltr">{{ question.prompt }}</bdi></p>
      <p v-else-if="question.type === 'mcq-word-to-definition' || question.type === 'mcq-word-to-image'" class="headword mt-3"><bdi lang="en" dir="ltr">{{ question.prompt }}</bdi></p>
      <MediaImage v-else-if="question.type === 'mcq-image-to-word'" class="mx-auto mt-3 w-full max-w-xs rounded-lg" :src="imageFor(question.promptImageWordId)" :width="4" :height="3" eager />
      <template v-else>
        <p class="mt-3 text-lead"><bdi lang="en" dir="ltr">{{ question.before }}</bdi><span class="mx-1 inline-block min-w-16 border-b-2 border-accent" aria-label="blank">&nbsp;</span><bdi lang="en" dir="ltr">{{ question.after }}</bdi></p>
        <p v-if="showHints" class="mt-3 text-sm text-muted">{{ t('quiz.meaning') }}: <bdi lang="en" dir="ltr">{{ question.hint }}</bdi></p>
      </template>
    </div>
    <ul class="mt-4" :class="imageOptions ? 'grid grid-cols-2 gap-3' : 'space-y-3'" role="group" :aria-label="t('quiz.answerOptions')">
      <li v-for="(option, index) in question.options" :key="option.id">
        <button type="button" class="flex min-h-14 w-full items-center gap-3 rounded-lg border-2 bg-surface p-3 text-start transition-colors" :class="stateClass(option.id)" :disabled="locked" :aria-keyshortcuts="String(index + 1)" @click="emit('select', option.id)">
          <span class="grid size-6 shrink-0 place-items-center rounded border border-line text-xs tabular-nums" aria-hidden="true">{{ index + 1 }}</span>
          <MediaImage v-if="option.imageWordId" class="min-w-0 flex-1 rounded-md" :src="imageFor(option.imageWordId)" :width="4" :height="3" />
          <bdi v-else class="min-w-0 flex-1" lang="en" dir="ltr">{{ option.text }}</bdi>
          <Check v-if="stateOf(option.id) === 'correct'" class="size-5 shrink-0 text-known" aria-hidden="true" />
          <X v-else-if="stateOf(option.id) === 'wrong'" class="size-5 shrink-0 text-unknown" aria-hidden="true" />
          <span v-if="stateOf(option.id) === 'correct'" class="sr-only">{{ t('quiz.correctAnswer') }}</span>
          <span v-else-if="stateOf(option.id) === 'wrong'" class="sr-only">{{ t('quiz.wrongAnswer') }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
