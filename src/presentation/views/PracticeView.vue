<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Play, TriangleAlert } from '@lucide/vue';
import { QUIZ_SETTING_LIMITS } from '@/domain/quiz/models';
import { PRACTICE_MODES, SCOPE_OPTIONS, buildScope, scopeToQuery, type ModeId, type ScopeKind } from '@/presentation/practiceQuery';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { usePracticeStore } from '@/presentation/stores/practice';
import { useQuizSettingsStore } from '@/presentation/stores/quizSettings';

const router = useRouter();
const books = useBooksStore();
const catalog = useCatalogStore();
const practice = usePracticeStore();
const quiz = useQuizSettingsStore();

const mode = ref<ModeId>('mixed');
const scopeKind = ref<ScopeKind>('book');
const unitIds = ref<string[]>([]);
const variant = ref<'definition' | 'image'>('definition');
const count = ref(10);

const units = computed(() => catalog.snapshot?.units ?? []);
const canStart = computed(() => scopeKind.value !== 'units' || unitIds.value.length > 0);
const limits = QUIZ_SETTING_LIMITS.quizQuestionCount;

onMounted(async () => {
  const bookId = books.activeBookId;
  if (!bookId) return;
  await Promise.all([catalog.load(bookId), practice.load(bookId), quiz.load()]);
  count.value = quiz.settings.quizQuestionCount;
});

function toggleUnit(unitId: string, checked: boolean): void {
  unitIds.value = checked ? [...unitIds.value, unitId] : unitIds.value.filter((id) => id !== unitId);
}

function start(): void {
  const scope = scopeToQuery(buildScope(scopeKind.value, unitIds.value));
  if (mode.value === 'matching') void router.push({ name: 'matching', query: { ...scope, variant: variant.value } });
  else void router.push({ name: 'quiz', query: { ...scope, mode: mode.value, count: String(count.value) } });
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-6 font-display text-title font-semibold">Practice</h1>

    <RouterLink v-if="practice.hub?.savedQuiz" class="card mb-6 flex items-center justify-between gap-3 p-4" :to="{ name: 'quiz', query: { resume: '1' } }">
      <span>
        <span class="block font-medium">Pick up where you left off</span>
        <span class="text-sm text-muted">{{ practice.hub.savedQuiz.answered }} answered so far</span>
      </span>
      <Play class="size-5 text-accent" aria-hidden="true" />
    </RouterLink>

    <fieldset class="mb-6">
      <legend class="mb-2 font-medium">Mode</legend>
      <div class="grid gap-3 sm:grid-cols-2" role="radiogroup">
        <label v-for="option in PRACTICE_MODES" :key="option.id" class="relative">
          <input v-model="mode" class="peer sr-only" type="radio" name="mode" :value="option.id" />
          <span class="block min-h-16 cursor-pointer rounded-lg border-2 border-line bg-surface p-3 peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
            <span class="block font-medium">{{ option.title }}</span>
            <span class="block text-sm text-muted">{{ option.description }}</span>
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset class="mb-6">
      <legend class="mb-2 font-medium">Words</legend>
      <div class="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1">
        <label v-for="option in SCOPE_OPTIONS" :key="option.kind" class="relative">
          <input v-model="scopeKind" class="peer sr-only" type="radio" name="scope" :value="option.kind" />
          <span class="grid min-h-10 cursor-pointer place-items-center rounded-md px-3 text-sm peer-checked:bg-accent peer-checked:text-[var(--on-accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{{ option.label }}</span>
        </label>
      </div>
      <ul v-if="scopeKind === 'units'" class="mt-3 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface">
        <li v-for="summary in units" :key="summary.unit.id">
          <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3">
            <input type="checkbox" class="size-5 accent-[var(--accent)]" :checked="unitIds.includes(summary.unit.id)" @change="toggleUnit(summary.unit.id, ($event.target as HTMLInputElement).checked)" />
            <span class="flex-1 truncate">{{ summary.unit.title }}</span>
          </label>
        </li>
      </ul>
    </fieldset>

    <fieldset v-if="mode === 'matching'" class="mb-6">
      <legend class="mb-2 font-medium">Pair words with</legend>
      <div class="inline-flex rounded-lg border border-line bg-surface p-1">
        <label class="relative"><input v-model="variant" class="peer sr-only" type="radio" name="variant" value="definition" /><span class="grid min-h-10 min-w-28 cursor-pointer place-items-center rounded-md px-3 text-sm peer-checked:bg-accent peer-checked:text-[var(--on-accent)]">Meanings</span></label>
        <label class="relative"><input v-model="variant" class="peer sr-only" type="radio" name="variant" value="image" /><span class="grid min-h-10 min-w-28 cursor-pointer place-items-center rounded-md px-3 text-sm peer-checked:bg-accent peer-checked:text-[var(--on-accent)]">Pictures</span></label>
      </div>
    </fieldset>
    <label v-else-if="mode !== 'timed'" class="mb-6 block text-sm">
      <span class="text-muted">Number of questions ({{ limits.min }}-{{ limits.max }})</span>
      <input v-model.number="count" type="number" inputmode="numeric" :min="limits.min" :max="limits.max" class="mt-1 min-h-11 w-32 rounded-lg border border-line bg-surface px-3 text-[16px]" />
    </label>

    <div class="mb-8 flex flex-wrap gap-3">
      <RouterLink class="btn" :to="{ name: 'mistakes' }">
        <TriangleAlert class="size-5" aria-hidden="true" /> Mistakes<span v-if="practice.hub" class="tabular-nums"> ({{ practice.hub.mistakeCount }})</span>
      </RouterLink>
      <RouterLink class="btn" :to="{ name: 'placement' }">Placement test</RouterLink>
    </div>

    <div class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
      <button type="button" class="btn btn-primary w-full" :disabled="!canStart" @click="start">
        <Play class="size-5" aria-hidden="true" /> Start
      </button>
      <p v-if="!canStart" class="mt-2 text-center text-sm text-muted">Choose at least one unit to start.</p>
    </div>
  </div>
</template>
