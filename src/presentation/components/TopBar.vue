<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Search } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <header class="sticky top-0 z-10 flex min-h-12 items-center justify-end border-b border-line bg-paper px-4 md:px-8">
    <RouterLink :to="{ name: 'search' }" class="icon-btn" :aria-label="t('nav.search')">
      <Search class="size-5" aria-hidden="true" />
    </RouterLink>
  </header>
</template>
