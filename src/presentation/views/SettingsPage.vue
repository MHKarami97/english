<script setup lang="ts">
import PracticeSettingsSection from '@/presentation/components/PracticeSettingsSection.vue';
import SettingsView from './SettingsView.vue';
</script>

<template>
  <div>
    <SettingsView />
    <div class="mx-auto w-full max-w-2xl px-4 pb-10 md:px-8">
      <PracticeSettingsSection />
    </div>
  </div>
</template>
