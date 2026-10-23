<script setup lang="ts">
import { usePwaStore } from '@/presentation/stores/pwa';

const pwa = usePwaStore();
</script>

<template>
  <div
    v-if="pwa.needRefresh || pwa.offlineReady"
    role="status"
    class="card fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-3 p-4 md:start-auto md:end-6 md:bottom-6 md:max-w-sm"
  >
    <p class="min-w-0 flex-1">
      {{ pwa.needRefresh ? 'A new version is ready.' : 'Ready to work offline.' }}
    </p>
    <button v-if="pwa.needRefresh" type="button" class="btn btn-primary" @click="pwa.applyUpdate()">Reload</button>
    <button type="button" class="btn" @click="pwa.dismiss()">{{ pwa.needRefresh ? 'Later' : 'Dismiss' }}</button>
  </div>
</template>
