<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@lucide/vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { usePracticeStore } from '@/presentation/stores/practice';

const { t } = useI18n();
const practice = usePracticeStore();
const status = ref<'loading' | 'ready' | 'error'>('loading');

onMounted(async () => { try { await practice.loadMistakes(); status.value = 'ready'; } catch { status.value = 'error'; } });
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <RouterLink class="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted" :to="{ name: 'practice' }"><ArrowLeft class="size-4 rtl:-scale-x-100" aria-hidden="true" /> {{ t('practice.title') }}</RouterLink>
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="font-display text-title font-semibold">{{ t('mistakes.title') }}</h1>
      <RouterLink v-if="practice.mistakes.length" class="btn btn-primary" :to="{ name: 'quiz', query: { mode: 'mistakes', scope: 'mistakes', count: '10' } }">{{ t('mistakes.practice') }}</RouterLink>
    </div>

    <div v-if="status === 'loading'" class="space-y-3" aria-hidden="true"><div v-for="row in 5" :key="row" class="skeleton h-16 w-full" /></div>
    <StateMessage v-else-if="status === 'error'" kind="error" :title="t('mistakes.errorTitle')" :body="t('mistakes.errorBody')" />
    <StateMessage v-else-if="practice.mistakes.length === 0" kind="empty" :title="t('mistakes.emptyTitle')" :body="t('mistakes.emptyBody')" />
    <ul v-else class="card divide-y divide-line">
      <li v-for="entry in practice.mistakes" :key="entry.mistake.wordId" class="flex items-center gap-3 px-4 py-3">
        <span class="min-w-0 flex-1"><bdi class="block font-display text-lg font-semibold" lang="en" dir="ltr">{{ entry.word.word }}</bdi><bdi class="block truncate text-sm text-muted" lang="en" dir="ltr">{{ entry.word.definition }}</bdi></span>
        <span class="shrink-0 text-end text-sm tabular-nums"><span class="block">{{ t('mistakes.missed', { n: entry.mistake.wrongCount }) }}</span><span class="block text-muted">{{ t('mistakes.progress', { n: entry.mistake.consecutiveCorrect }) }}</span></span>
      </li>
    </ul>
  </div>
</template>
