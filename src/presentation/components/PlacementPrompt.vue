<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBooksStore } from '@/presentation/stores/books';
import { usePracticeStore } from '@/presentation/stores/practice';

const { t } = useI18n();
const books = useBooksStore();
const practice = usePracticeStore();

onMounted(() => {
  if (books.activeBookId) void practice.load(books.activeBookId);
});
</script>

<template>
  <div v-if="practice.hub && !practice.hub.promptDismissed && !practice.hub.placement" class="mx-auto w-full max-w-5xl px-4 pt-6 md:px-8">
    <section class="card p-5" aria-labelledby="placement-prompt-title">
      <h2 id="placement-prompt-title" class="font-display text-xl font-semibold">{{ t('placementPrompt.title') }}</h2>
      <p class="mt-1 text-muted">{{ t('placementPrompt.body') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink class="btn btn-primary" :to="{ name: 'placement' }">{{ t('placementPrompt.take') }}</RouterLink>
        <button type="button" class="btn" @click="practice.dismissPrompt()">{{ t('placementPrompt.notNow') }}</button>
      </div>
    </section>
  </div>
</template>
