<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Volume2 } from '@lucide/vue';
import type { TypingQuestion } from '@/domain/quiz/questions';

defineProps<{ question: TypingQuestion; showHints: boolean; locked: boolean }>();
const emit = defineEmits<{ submit: [text: string]; play: [] }>();

const answer = ref('');
const input = ref<HTMLInputElement | null>(null);

onMounted(() => input.value?.focus());
</script>

<template>
  <div>
    <div class="card p-5 text-center md:p-8">
      <template v-if="question.type === 'cloze-typing'">
        <p class="text-sm text-muted">Type the missing word.</p>
        <p class="mt-3 text-lead">{{ question.before }}<span class="mx-1 inline-block min-w-16 border-b-2 border-accent" aria-label="blank">&nbsp;</span>{{ question.after }}</p>
        <p v-if="showHints" class="mt-3 text-sm text-muted">Meaning: {{ question.hint }}</p>
      </template>
      <template v-else>
        <p class="text-sm text-muted">Listen, then type the word you hear.</p>
        <button type="button" class="btn btn-primary mt-4 min-h-14 px-6" @click="emit('play')">
          <Volume2 class="size-5" aria-hidden="true" /> Play the word
        </button>
        <p v-if="showHints" class="mt-3 text-sm text-muted">{{ question.answerLabel.length }} letters</p>
      </template>
    </div>

    <form class="mt-4 flex gap-3" @submit.prevent="emit('submit', answer)">
      <label class="sr-only" for="typed-answer">Your answer</label>
      <input
        id="typed-answer"
        ref="input"
        v-model="answer"
        type="text"
        class="min-h-14 min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-4 text-[16px]"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="done"
        :disabled="locked"
      />
      <button type="submit" class="btn btn-primary min-h-14 px-5" :disabled="locked || answer.trim().length === 0">Check</button>
    </form>
  </div>
</template>
