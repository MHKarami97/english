<script setup lang="ts">
import { computed } from 'vue';
import { Check, X } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import type { ChoiceQuestion } from '@/domain/quiz/questions';
import MediaImage from './MediaImage.vue';

const props = defineProps<{
  question: ChoiceQuestion;
  related: ReadonlyMap<string, Word>;
  selectedId: string | null;
  revealedId: string | null;
  showHints: boolean;
}>();
const emit = defineEmits<{ select: [optionId: string] }>();

const locked = computed(() => props.revealedId !== null);
const imageOptions = computed(() => props.question.options.some((option) => option.imageWordId !== undefined));
const instruction = computed(() => {
  switch (props.question.type) {
    case 'mcq-definition-to-word':
      return 'Which word matches this meaning?';
    case 'mcq-word-to-definition':
      return 'What does this word mean?';
    case 'mcq-image-to-word':
      return 'Which word matches this picture?';
    case 'mcq-word-to-image':
      return 'Which picture shows this word?';
    default:
      return 'Which word completes the sentence?';
  }
});

const imageFor = (wordId: string | undefined): string | null => {
  const word = wordId ? props.related.get(wordId) : undefined;
  return word ? container.media.wordImage(word) : null;
};

function stateOf(optionId: string): 'correct' | 'wrong' | 'selected' | 'idle' {
  if (props.revealedId !== null) {
    if (optionId === props.revealedId) return 'correct';
    return optionId === props.selectedId ? 'wrong' : 'idle';
  }
  return optionId === props.selectedId ? 'selected' : 'idle';
}

const stateClass = (optionId: string): string =>
  ({
    correct: 'border-known bg-known/10',
    wrong: 'border-unknown bg-unknown/10',
    selected: 'border-accent',
    idle: 'border-line hover:border-muted',
  })[stateOf(optionId)];
</script>

<template>
  <div>
    <div class="card p-5 text-center md:p-8">
      <p class="text-sm text-muted">{{ instruction }}</p>
      <p v-if="question.type === 'mcq-definition-to-word'" class="mt-3 text-lead">{{ question.prompt }}</p>
      <p v-else-if="question.type === 'mcq-word-to-definition' || question.type === 'mcq-word-to-image'" class="headword mt-3">{{ question.prompt }}</p>
      <MediaImage v-else-if="question.type === 'mcq-image-to-word'" class="mx-auto mt-3 w-full max-w-xs rounded-lg" :src="imageFor(question.promptImageWordId)" :width="4" :height="3" eager />
      <template v-else>
        <p class="mt-3 text-lead">{{ question.before }}<span class="mx-1 inline-block min-w-16 border-b-2 border-accent" aria-label="blank">&nbsp;</span>{{ question.after }}</p>
        <p v-if="showHints" class="mt-3 text-sm text-muted">Meaning: {{ question.hint }}</p>
      </template>
    </div>

    <ul class="mt-4" :class="imageOptions ? 'grid grid-cols-2 gap-3' : 'space-y-3'" role="group" aria-label="Answer options">
      <li v-for="(option, index) in question.options" :key="option.id">
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 rounded-lg border-2 bg-surface p-3 text-start transition-colors"
          :class="stateClass(option.id)"
          :disabled="locked"
          :aria-keyshortcuts="String(index + 1)"
          @click="emit('select', option.id)"
        >
          <span class="grid size-6 shrink-0 place-items-center rounded border border-line text-xs tabular-nums" aria-hidden="true">{{ index + 1 }}</span>
          <MediaImage v-if="option.imageWordId" class="min-w-0 flex-1 rounded-md" :src="imageFor(option.imageWordId)" :width="4" :height="3" />
          <span v-else class="min-w-0 flex-1">{{ option.text }}</span>
          <Check v-if="stateOf(option.id) === 'correct'" class="size-5 shrink-0 text-known" aria-hidden="true" />
          <X v-else-if="stateOf(option.id) === 'wrong'" class="size-5 shrink-0 text-unknown" aria-hidden="true" />
          <span v-if="stateOf(option.id) === 'correct'" class="sr-only">Correct answer</span>
          <span v-else-if="stateOf(option.id) === 'wrong'" class="sr-only">Your answer, not correct</span>
        </button>
      </li>
    </ul>
  </div>
</template>
