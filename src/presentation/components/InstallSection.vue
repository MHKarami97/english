<script setup lang="ts">
import { onMounted } from 'vue';
import { useInstallStore } from '@/presentation/stores/install';

const install = useInstallStore();

onMounted(() => install.init());
</script>

<template>
  <section v-if="install.ui !== 'none'" aria-labelledby="install-title">
    <h2 id="install-title" class="mb-1 font-medium">Install the app</h2>
    <template v-if="install.ui === 'prompt'">
      <p class="text-sm text-muted">Add it to your home screen or desktop. It opens faster and keeps working offline.</p>
      <button type="button" class="btn btn-primary mt-3" @click="install.install()">Install</button>
    </template>
    <p v-else class="text-sm text-muted">In Safari, tap the Share button, then choose Add to Home Screen.</p>
  </section>
</template>
