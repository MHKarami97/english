<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ src: string | null; width: number; height: number; eager?: boolean }>();
const failed = ref(false);
</script>

<template>
  <div class="media-box" :style="{ aspectRatio: `${width} / ${height}` }">
    <img
      v-if="src && !failed"
      :src="src"
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      alt=""
      @error="failed = true"
    />
  </div>
</template>
