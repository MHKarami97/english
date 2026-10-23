<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ActivityStrip from '@/presentation/components/ActivityStrip.vue';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import TodayCard from '@/presentation/components/TodayCard.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useTodayStore } from '@/presentation/stores/today';

const router = useRouter();
const books = useBooksStore();
const today = useTodayStore();
const moreDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

onMounted(() => {
  if (books.activeBookId) void today.load(books.activeBookId);
});

function studyMore(): void {
  void router.push({ name: 'review', query: { extra: '10' } });
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-6 font-display text-title font-semibold">Today</h1>

    <StateMessage v-if="today.status === 'error'" kind="error" title="Could not plan today" body="Your cards could not be read. Reload the page and try again." />
    <div v-else-if="!today.summary" class="card p-6" aria-hidden="true">
      <div class="skeleton h-4 w-16" />
      <div class="skeleton mt-3 h-8 w-2/3" />
      <div class="skeleton mt-6 h-11 w-40" />
    </div>
    <template v-else>
      <TodayCard :summary="today.summary">
        <template #footer>
          <button v-if="today.summary.plannedTotal === 0" type="button" class="btn mt-5" @click="moreDialog?.open()">Study more</button>
        </template>
      </TodayCard>
      <section class="mt-8" aria-labelledby="week-title">
        <h2 id="week-title" class="mb-3 text-sm font-medium text-muted">Last seven days</h2>
        <ActivityStrip :week="today.summary.week" />
      </section>
    </template>

    <ConfirmDialog ref="moreDialog" title="Study more new words?" body="This adds 10 new words beyond your daily limit." confirm-label="Add them" @confirm="studyMore" />
  </div>
</template>
