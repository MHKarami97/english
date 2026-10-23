<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { CalendarCheck, Dumbbell, House, Library, Settings } from '@lucide/vue';
import { APP_NAME } from '@/config/app';

defineProps<{ hideOnPhone: boolean }>();

const items = [
  { to: '/', label: 'Home', icon: House },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/practice', label: 'Practice', icon: Dumbbell },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;
</script>

<template>
  <nav
    aria-label="Main"
    class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:inset-auto md:top-0 md:flex md:h-dvh md:w-20 md:shrink-0 md:flex-col md:border-t-0 md:border-e md:pb-0 lg:w-60"
    :class="{ 'max-md:hidden': hideOnPhone }"
  >
    <p class="hidden px-6 pt-8 pb-4 font-display text-xl font-semibold lg:block">{{ APP_NAME }}</p>
    <ul class="grid grid-cols-5 md:flex md:flex-col md:gap-1 md:p-3">
      <li v-for="item in items" :key="item.to">
        <RouterLink :to="item.to" class="nav-link">
          <component :is="item.icon" class="size-5 shrink-0" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
