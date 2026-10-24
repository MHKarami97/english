<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { container } from '@/container';

const route = useRoute();
const due = ref(false);

onMounted(async () => {
  due.value = await container.backupReminder.isDue().catch(() => false);
});

async function later(): Promise<void> {
  due.value = false;
  await container.backupReminder.dismiss();
}
</script>

<template>
  <div
    v-if="due && route.name !== 'settings'"
    role="status"
    class="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm"
  >
    <p class="min-w-0 flex-1">Your progress lives only on this device. It has been a while since you saved a copy.</p>
    <RouterLink :to="{ name: 'settings' }" class="btn">Back up</RouterLink>
    <button type="button" class="btn" @click="later">Later</button>
  </div>
</template>
