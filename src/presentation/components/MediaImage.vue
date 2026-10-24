<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{ src: string | null; width: number; height: number; eager?: boolean }>();
const { t } = useI18n();
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
    <div v-else class="grid h-full w-full place-items-center bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted">
      <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m5 18 4.5-5 3 3.5L16 12l3 4" />
      </svg>
      <span class="sr-only">{{ t('media.unavailable') }}</span>
    </div>
  </div>
</template>
