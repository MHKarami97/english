<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import ChoiceQuestionView from '@/presentation/components/ChoiceQuestionView.vue';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { usePlacementStore } from '@/presentation/stores/placement';

const books = useBooksStore();
const catalog = useCatalogStore();
const placement = usePlacementStore();
const started = ref(false);
const markDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

const view = computed(() => placement.view);
const units = computed(() => catalog.snapshot?.units ?? []);
const rows = computed(() =>
  units.value
    .filter((summary) => view.value?.outcome?.perUnitAccuracy[summary.unit.id] !== undefined)
    .map((summary) => ({ id: summary.unit.id, title: summary.unit.title, accuracy: view.value?.outcome?.perUnitAccuracy[summary.unit.id] ?? 0 })),
);
const confidenceText = computed(() => ({ low: 'low', medium: 'medium', high: 'fairly good' })[view.value?.outcome?.confidence ?? 'low']);

onMounted(() => {
  if (books.activeBookId) void catalog.load(books.activeBookId);
});

async function begin(): Promise<void> {
  if (!books.activeBookId) return;
  started.value = true;
  await placement.start(books.activeBookId);
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="placement-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="{ name: 'practice' }" aria-label="Back to Practice"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="placement-title" class="text-sm font-medium text-muted">Placement test</h1>
        <p v-if="view?.status === 'question'" class="text-sm tabular-nums">{{ view.unitTitle }}, {{ view.answered }} answered</p>
      </div>
    </header>

    <div v-if="!started" class="py-8">
      <h2 class="font-display text-title font-semibold">Find a good place to start</h2>
      <p class="mt-3 text-muted">You will answer a few multiple-choice questions from each unit, in book order. The test stops when two units in a row go badly.</p>
      <p class="mt-3">This is a rough estimate, not a measure of your level. A few questions per unit means a lucky guess or a slip can move the result, and nothing changes in the app until you confirm.</p>
      <button type="button" class="btn btn-primary mt-6" @click="begin">Start the test</button>
    </div>

    <div v-else-if="placement.status === 'loading'" class="mt-6 space-y-3" aria-hidden="true"><div class="skeleton h-40 w-full rounded-xl" /><div v-for="row in 4" :key="row" class="skeleton h-14 w-full" /></div>
    <StateMessage v-else-if="placement.status === 'error'" kind="error" title="Could not run the test" body="Your words could not be read. Reload the page and try again." />
    <StateMessage v-else-if="view?.empty" kind="empty" title="Not enough words" body="The test needs units with meanings to ask about." />

    <div v-else-if="view?.status === 'question' && view.question && view.target" class="flex flex-1 flex-col justify-center py-4">
      <ChoiceQuestionView :key="view.question.id" :question="view.question" :related="new Map()" :selected-id="null" :revealed-id="null" :show-hints="false" @select="placement.answer" />
    </div>

    <div v-else-if="view?.status === 'finished' && view.outcome" class="py-6">
      <h2 class="font-display text-title font-semibold">Your estimate</h2>
      <p class="mt-2">
        <template v-if="placement.preview?.startUnit">A good place to start is <strong class="font-semibold">{{ placement.preview.startUnit.title }}</strong>.</template>
        <template v-else>There was not enough to estimate a starting unit.</template>
        Confidence is {{ confidenceText }}, from {{ view.outcome.answered }} answers. Treat this as a rough guide.
      </p>

      <ul class="mt-5 space-y-3" aria-label="Accuracy per unit">
        <li v-for="row in rows" :key="row.id">
          <div class="flex justify-between text-sm"><span>{{ row.title }}</span><span class="tabular-nums">{{ Math.round(row.accuracy * 100) }}%</span></div>
          <div class="bar mt-1"><span :style="{ inlineSize: `${row.accuracy * 100}%` }" /></div>
        </li>
      </ul>

      <div v-if="placement.preview?.startUnit" class="mt-8 space-y-3">
        <button type="button" class="btn btn-primary w-full" :disabled="placement.applied !== null" @click="placement.apply(false)">Start from {{ placement.preview.startUnit.title }}</button>
        <p class="text-sm text-muted">Only the {{ placement.preview.activeUnitCount }} units from there onward will be used for new words.</p>
        <button type="button" class="btn w-full" :disabled="placement.applied !== null || placement.preview.wordsToMarkKnown === 0" @click="markDialog?.open()">Also mark earlier words as known ({{ placement.preview.wordsToMarkKnown }})</button>
      </div>

      <div v-if="placement.applied" class="card mt-6 p-4" role="status">
        <p>Done. {{ placement.applied.activeUnitCount }} units are active<template v-if="placement.applied.markedWords > 0"> and {{ placement.applied.markedWords }} words were marked as known</template>.</p>
        <button v-if="placement.canUndo" type="button" class="btn mt-3" @click="placement.undo()">Undo</button>
      </div>
      <RouterLink class="btn mt-6" :to="{ name: 'practice' }">Back to Practice</RouterLink>
    </div>

    <ConfirmDialog ref="markDialog" title="Mark earlier words as known?" :body="`${placement.preview?.wordsToMarkKnown ?? 0} words in earlier units will be marked as known and skipped when new words are chosen. You can undo this right after.`" confirm-label="Mark as known" @confirm="placement.apply(true)" />
  </section>
</template>
