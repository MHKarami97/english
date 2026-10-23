<script setup lang="ts">
import type { ExampleSegment } from '@/domain/entities';

defineProps<{ segments: readonly ExampleSegment[] }>();
</script>

<template>
  <p>
    <template v-for="(segment, position) in segments" :key="position">
      <span v-if="segment.highlight" class="example-hl">{{ segment.text }}</span>
      <template v-else>{{ segment.text }}</template>
    </template>
  </p>
</template>
