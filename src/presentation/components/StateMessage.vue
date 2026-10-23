<script setup lang="ts">
import { computed } from 'vue';
import { Inbox, TriangleAlert, WifiOff } from '@lucide/vue';

const props = defineProps<{ kind: 'empty' | 'error' | 'offline'; title: string; body: string }>();
const icon = computed(() => ({ empty: Inbox, error: TriangleAlert, offline: WifiOff })[props.kind]);
</script>

<template>
  <div class="mx-auto max-w-sm py-12 text-center" :role="kind === 'error' ? 'alert' : 'status'">
    <component :is="icon" class="mx-auto size-8 text-muted" aria-hidden="true" />
    <h2 class="mt-4 font-display text-xl font-semibold">{{ title }}</h2>
    <p class="mt-2 text-muted">{{ body }}</p>
    <div class="mt-6 flex flex-wrap justify-center gap-3"><slot /></div>
  </div>
</template>
