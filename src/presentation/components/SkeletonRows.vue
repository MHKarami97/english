<script setup lang="ts">
defineProps<{ count: number; rowHeight?: number }>();
</script>

<template>
  <ul class="card divide-y divide-line" aria-hidden="true">
    <li
      v-for="row in count"
      :key="row"
      class="flex items-center gap-3 px-3"
      :style="{ blockSize: `${rowHeight ?? 72}px` }"
    >
      <div class="skeleton size-12 shrink-0" />
      <div class="flex-1 space-y-2">
        <div class="skeleton h-4 w-1/2" />
        <div class="skeleton h-3 w-1/4" />
      </div>
      <div class="skeleton size-9 shrink-0 rounded-full" />
    </li>
  </ul>
</template>
