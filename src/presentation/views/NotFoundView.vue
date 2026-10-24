<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import StateMessage from '@/presentation/components/StateMessage.vue';

const { t } = useI18n();
</script>

<template>
  <StateMessage kind="empty" :title="t('notFound.title')" :body="t('notFound.body')">
    <RouterLink to="/" class="btn btn-primary">{{ t('notFound.home') }}</RouterLink>
  </StateMessage>
</template>
