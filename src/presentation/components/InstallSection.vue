<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useInstallStore } from '@/presentation/stores/install';

const { t } = useI18n();
const install = useInstallStore();

onMounted(() => install.init());
</script>

<template>
  <section v-if="install.ui !== 'none'" aria-labelledby="install-title">
    <h2 id="install-title" class="mb-1 font-medium">{{ t('install.title') }}</h2>
    <template v-if="install.ui === 'prompt'">
      <p class="text-sm text-muted">{{ t('install.hint') }}</p>
      <button type="button" class="btn btn-primary mt-3" @click="install.install()">{{ t('install.button') }}</button>
    </template>
    <p v-else class="text-sm text-muted">{{ t('install.ios') }}</p>
  </section>
</template>
