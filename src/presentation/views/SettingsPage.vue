<script setup lang="ts">
import DownloadsSection from '@/presentation/components/DownloadsSection.vue';
import InstallSection from '@/presentation/components/InstallSection.vue';
import PracticeSettingsSection from '@/presentation/components/PracticeSettingsSection.vue';
import SettingsView from './SettingsView.vue';
</script>

<template>
  <div>
    <SettingsView />
    <div class="mx-auto w-full max-w-2xl px-4 pb-10 md:px-8">
      <PracticeSettingsSection />
      <DownloadsSection class="mt-8" />
      <InstallSection class="mt-8" />
    </div>
  </div>
</template>
