<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { usePwaStore } from '@/presentation/stores/pwa';

const { t } = useI18n();
const pwa = usePwaStore();
</script>

<template>
  <div
    v-if="pwa.needRefresh || pwa.offlineReady"
    role="status"
    class="card fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-3 p-4 md:start-auto md:end-6 md:bottom-6 md:max-w-sm"
  >
    <button v-if="pwa.needRefresh" type="button" class="btn btn-primary" @click="pwa.applyUpdate()">
      {{ t('update.reload') }}
    </button>
    <button type="button" class="btn" @click="pwa.dismiss()">
      {{ pwa.needRefresh ? t('common.later') : t('common.dismiss') }}
    </button>
  </div>
</template>
