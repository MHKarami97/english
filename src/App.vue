<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { WifiOff } from '@lucide/vue';
import NavBar from '@/presentation/components/NavBar.vue';
import ImportScreen from '@/presentation/components/ImportScreen.vue';
import TopBar from '@/presentation/components/TopBar.vue';
import UpdateToast from '@/presentation/components/UpdateToast.vue';
import { useOnline } from '@/presentation/composables/useOnline';
import { useBooksStore } from '@/presentation/stores/books';
import { usePwaStore } from '@/presentation/stores/pwa';
import { useSettingsStore } from '@/presentation/stores/settings';

const route = useRoute();
const books = useBooksStore();
const settings = useSettingsStore();
const pwa = usePwaStore();
const online = useOnline();
const immersive = computed(() => route.meta.immersive === true);
const showTopBar = computed(() => books.phase === 'ready' && !immersive.value && route.name !== 'search');

onMounted(() => {
  void settings.init();
  pwa.init();
  void books.bootstrap();
});
</script>

<template>
  <div class="min-h-dvh md:flex">
    <NavBar v-if="books.phase === 'ready'" :hide-on-phone="immersive" />
    <div class="min-w-0 flex-1">
      <TopBar v-if="showTopBar" />
      <p
        v-if="!online"
        role="status"
        class="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-sm text-muted"
      >
        <WifiOff class="size-4 shrink-0" aria-hidden="true" />
        You are offline. Saved words still work; audio and pictures you have not opened before may be missing.
      </p>
      <main
        class="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8"
        :class="{ 'max-md:pb-[env(safe-area-inset-bottom)]': immersive }"
      >
        <ImportScreen v-if="books.phase !== 'ready'" />
        <RouterView v-else :key="books.dataVersion" />
      </main>
    </div>
    <UpdateToast />
  </div>
</template>
