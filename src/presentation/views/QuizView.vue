<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Flame, SkipForward } from '@lucide/vue';
import type { QuizMode } from '@/domain/quiz/models';
import { isChoiceQuestion } from '@/domain/quiz/questions';
import ChoiceQuestionView from '@/presentation/components/ChoiceQuestionView.vue';
import FeedbackPanel from '@/presentation/components/FeedbackPanel.vue';
import QuizResults from '@/presentation/components/QuizResults.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import TypingQuestionView from '@/presentation/components/TypingQuestionView.vue';
import { PRACTICE_MODES, formatClock, scopeFromQuery } from '@/presentation/practiceQuery';
import { useBooksStore } from '@/presentation/stores/books';
import { useQuizStore } from '@/presentation/stores/quiz';

const ADVANCE_DELAY_MS = 1200;
const MODES: readonly QuizMode[] = ['mcq', 'cloze', 'dictation', 'pictures', 'mixed', 'timed', 'mistakes'];

const { t } = useI18n();
const route = useRoute();
const books = useBooksStore();
const quiz = useQuizStore();
const selectedId = ref<string | null>(null);
let advanceTimer: ReturnType<typeof setTimeout> | undefined;

const view = computed(() => quiz.view);
const current = computed(() => view.value?.current ?? null);
const choice = computed(() => (current.value && isChoiceQuestion(current.value.question) ? current.value.question : null));
const typing = computed(() => (current.value && !isChoiceQuestion(current.value.question) ? current.value.question : null));
const inFeedback = computed(() => view.value?.status === 'feedback');
const revealedId = computed(() => (inFeedback.value && choice.value ? choice.value.correctOptionId : null));
const title = computed(() => {
  const mode = view.value?.mode;
  return PRACTICE_MODES.some((option) => option.id === mode) ? t(`practice.modes.${mode}.title`) : t('practice.mistakesTitle');
});
const progress = computed(() => {
  const total = view.value?.total ?? 0;
  return total === 0 ? 0 : Math.min(100, ((view.value?.answered ?? 0) / total) * 100);
});
const timeLeft = computed(() => formatClock(quiz.remainingMs ?? 0));

function requestedMode(): QuizMode {
  const mode = String(route.query.mode ?? 'mixed') as QuizMode;
  return MODES.includes(mode) ? mode : 'mixed';
}

async function begin(mode: QuizMode = requestedMode(), scope = scopeFromQuery(route.query)): Promise<void> {
  const bookId = books.activeBookId;
  if (!bookId) return;
  selectedId.value = null;
  const count = Number(route.query.count);
  await quiz.start({ bookId, mode, scope, count: count > 0 ? count : undefined });
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  const bookId = books.activeBookId;
  if (route.query.resume && bookId && (await quiz.resume(bookId))) return;
  await begin();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  clearTimeout(advanceTimer);
  quiz.leave();
});

function scheduleAdvance(): void {
  clearTimeout(advanceTimer);
  const next = quiz.view;
  if (next?.status === 'feedback' && next.autoAdvance && next.grade?.correct) advanceTimer = setTimeout(() => void goNext(), ADVANCE_DELAY_MS);
}

async function submit(text: string): Promise<void> {
  if (view.value?.status !== 'question') return;
  await quiz.answer(text);
  scheduleAdvance();
}

async function pick(optionId: string): Promise<void> {
  selectedId.value = optionId;
  await submit(optionId);
}

async function skip(): Promise<void> {
  await quiz.skip();
  scheduleAdvance();
}

async function goNext(): Promise<void> {
  clearTimeout(advanceTimer);
  if (view.value?.status !== 'feedback') return;
  selectedId.value = null;
  await quiz.next();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const typingInField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (event.code === 'KeyP' && !typingInField) {
    quiz.playTarget();
    return;
  }
  if (typingInField) return;
  const digit = /^(?:Digit|Numpad)([1-6])$/.exec(event.code);
  if (digit && choice.value && view.value?.status === 'question') {
    const option = choice.value.options[Number(digit[1]) - 1];
    if (option) selectedId.value = option.id;
    return;
  }
  if (event.code === 'Enter' && !(target instanceof HTMLButtonElement)) {
    event.preventDefault();
    if (view.value?.status === 'feedback') void goNext();
    else if (selectedId.value) void pick(selectedId.value);
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="quiz-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="{ name: 'practice' }" :aria-label="t('quiz.backToPractice')"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="quiz-title" class="truncate text-sm font-medium text-muted">{{ title }}</h1>
        <p v-if="view && view.status !== 'finished' && view.timed" class="text-sm tabular-nums" role="timer">{{ t('quiz.timeLeft', { time: timeLeft, correct: view.correct }) }}</p>
        <p v-else-if="view && view.status !== 'finished'" class="text-sm tabular-nums" aria-live="polite">{{ t('quiz.questionOf', { current: Math.min(view.answered + (inFeedback ? 0 : 1), view.total ?? 0), total: view.total }) }}</p>
      </div>
      <p v-if="view && view.streak >= 2 && view.status !== 'finished'" class="flex items-center gap-1 text-sm"><Flame class="size-4 text-accent" aria-hidden="true" />{{ t('quiz.inARow', { n: view.streak }) }}</p>
    </header>

    <div v-if="view && view.status !== 'finished'" class="bar mt-2" role="progressbar" :aria-label="t('quiz.progress')" :aria-valuenow="Math.round(view.timed ? ((quiz.remainingMs ?? 0) / 600) : progress)" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ inlineSize: view.timed ? `${Math.min(100, ((quiz.remainingMs ?? 0) / 1000) * (100 / 60))}%` : `${progress}%` }" />
    </div>

    <div v-if="quiz.status === 'loading' || quiz.status === 'idle'" class="mt-6 space-y-3" aria-hidden="true">
      <div class="skeleton h-40 w-full rounded-xl" />
      <div v-for="row in 4" :key="row" class="skeleton h-14 w-full" />
    </div>
    <StateMessage v-else-if="quiz.status === 'error'" kind="error" :title="t('quiz.startError')" :body="t('quiz.startErrorBody')" />
    <StateMessage v-else-if="view?.empty" kind="empty" :title="t('quiz.emptyTitle')" :body="t('quiz.emptyBody')">
      <RouterLink class="btn btn-primary" :to="{ name: 'practice' }">{{ t('quiz.backToPractice') }}</RouterLink>
    </StateMessage>
    <QuizResults v-else-if="view?.status === 'finished' && quiz.summary" :summary="quiz.summary" @again="begin()" @review-mistakes="begin('mistakes', { kind: 'mistakes' })" />

    <template v-else-if="view && current">
      <div class="flex flex-1 flex-col justify-center py-4">
        <ChoiceQuestionView v-if="choice" :key="choice.id + current.position" :question="choice" :related="current.related" :selected-id="selectedId" :revealed-id="revealedId" :show-hints="view.showHints" @select="pick" />
        <TypingQuestionView v-else-if="typing" :key="typing.id + current.position" :question="typing" :show-hints="view.showHints" :locked="inFeedback" @submit="submit" @play="quiz.playTarget()" />
        <FeedbackPanel v-if="inFeedback && view.grade" :grade="view.grade" :target="current.target" :auto-advance="view.autoAdvance" @next="goNext" @play="quiz.playTarget()" />
      </div>
      <button v-if="view.status === 'question'" type="button" class="btn self-center" @click="skip"><SkipForward class="size-5 rtl:-scale-x-100" aria-hidden="true" /> {{ t('quiz.skip') }}</button>
      <p class="mt-3 hidden text-center text-sm text-muted md:block">{{ t('quiz.hints') }}</p>
    </template>
  </section>
</template>
