<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@lucide/vue';
import ChoiceQuestionView from '@/presentation/components/ChoiceQuestionView.vue';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { usePlacementStore } from '@/presentation/stores/placement';

const { t } = useI18n();
const books = useBooksStore();
const catalog = useCatalogStore();
const placement = usePlacementStore();
const started = ref(false);
const markDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

const view = computed(() => placement.view);
const units = computed(() => catalog.snapshot?.units ?? []);
const rows = computed(() => units.value.filter((summary) => view.value?.outcome?.perUnitAccuracy[summary.unit.id] !== undefined).map((summary) => ({ id: summary.unit.id, title: summary.unit.title, accuracy: view.value?.outcome?.perUnitAccuracy[summary.unit.id] ?? 0 })));
const confidenceText = computed(() => t(`placement.confidence.${view.value?.outcome?.confidence ?? 'low'}`));

onMounted(() => { if (books.activeBookId) void catalog.load(books.activeBookId); });
async function begin(): Promise<void> { if (!books.activeBookId) return; started.value = true; await placement.start(books.activeBookId); }
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="placement-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="{ name: 'practice' }" :aria-label="t('quiz.backToPractice')"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="placement-title" class="text-sm font-medium text-muted">{{ t('placement.title') }}</h1>
        <p v-if="view?.status === 'question'" class="text-sm tabular-nums"><bdi lang="en" dir="ltr">{{ view.unitTitle }}</bdi>, {{ t('placement.answered', { n: view.answered }) }}</p>
      </div>
    </header>

    <div v-if="!started" class="py-8">
      <h2 class="font-display text-title font-semibold">{{ t('placement.intro.title') }}</h2>
      <p class="mt-3 text-muted">{{ t('placement.intro.body') }}</p>
      <p class="mt-3">{{ t('placement.intro.disclaimer') }}</p>
      <button type="button" class="btn btn-primary mt-6" @click="begin">{{ t('placement.intro.start') }}</button>
    </div>

    <div v-else-if="placement.status === 'loading'" class="mt-6 space-y-3" aria-hidden="true"><div class="skeleton h-40 w-full rounded-xl" /><div v-for="row in 4" :key="row" class="skeleton h-14 w-full" /></div>
    <StateMessage v-else-if="placement.status === 'error'" kind="error" :title="t('placement.errorTitle')" :body="t('placement.errorBody')" />
    <StateMessage v-else-if="view?.empty" kind="empty" :title="t('placement.emptyTitle')" :body="t('placement.emptyBody')" />

    <div v-else-if="view?.status === 'question' && view.question && view.target" class="flex flex-1 flex-col justify-center py-4">
      <ChoiceQuestionView :key="view.question.id" :question="view.question" :related="new Map()" :selected-id="null" :revealed-id="null" :show-hints="false" @select="placement.answer" />
    </div>

    <div v-else-if="view?.status === 'finished' && view.outcome" class="py-6">
      <h2 class="font-display text-title font-semibold">{{ t('placement.result.title') }}</h2>
      <p class="mt-2">
        <template v-if="placement.preview?.startUnit">{{ t('placement.result.startAt') }} <bdi lang="en" dir="ltr"><strong class="font-semibold">{{ placement.preview.startUnit.title }}</strong></bdi>.</template>
        <template v-else>{{ t('placement.result.noStart') }}</template>
        {{ t('placement.result.confidence', { confidence: confidenceText, n: view.outcome.answered }) }}
      </p>

      <ul class="mt-5 space-y-3" :aria-label="t('placement.result.accuracyPerUnit')">
        <li v-for="row in rows" :key="row.id">
          <div class="flex justify-between text-sm"><bdi lang="en" dir="ltr">{{ row.title }}</bdi><span class="tabular-nums">{{ Math.round(row.accuracy * 100) }}%</span></div>
          <div class="bar mt-1"><span :style="{ inlineSize: `${row.accuracy * 100}%` }" /></div>
        </li>
      </ul>

      <div v-if="placement.preview?.startUnit" class="mt-8 space-y-3">
        <button type="button" class="btn btn-primary w-full" :disabled="placement.applied !== null" @click="placement.apply(false)">{{ t('placement.result.startFrom', { unit: placement.preview.startUnit.title }) }}</button>
        <p class="text-sm text-muted">{{ t('placement.result.activeUnits', { n: placement.preview.activeUnitCount }) }}</p>
        <button type="button" class="btn w-full" :disabled="placement.applied !== null || placement.preview.wordsToMarkKnown === 0" @click="markDialog?.open()">{{ t('placement.result.markEarlier', { n: placement.preview.wordsToMarkKnown }) }}</button>
      </div>

      <div v-if="placement.applied" class="card mt-6 p-4" role="status">
        <p>{{ t('placement.result.applied', { units: placement.applied.activeUnitCount, words: placement.applied.markedWords }) }}</p>
        <button v-if="placement.canUndo" type="button" class="btn mt-3" @click="placement.undo()">{{ t('common.undo') }}</button>
      </div>
      <RouterLink class="btn mt-6" :to="{ name: 'practice' }">{{ t('quiz.backToPractice') }}</RouterLink>
    </div>

    <ConfirmDialog ref="markDialog" :title="t('placement.dialog.title')" :body="t('placement.dialog.body', { n: placement.preview?.wordsToMarkKnown ?? 0 })" :confirm-label="t('placement.dialog.confirm')" @confirm="placement.apply(true)" />
  </section>
</template>
