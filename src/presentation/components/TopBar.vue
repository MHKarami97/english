<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Search } from '@lucide/vue';
</script>

<template>
  <header class="sticky top-0 z-10 flex min-h-12 items-center justify-end border-b border-line bg-paper px-4 md:px-8">
    <RouterLink :to="{ name: 'search' }" class="icon-btn" aria-label="Search words">
      <Search class="size-5" aria-hidden="true" />
    </RouterLink>
  </header>
</template>
