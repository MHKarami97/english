<script setup lang="ts">
import { RouterLink } from 'vue-router';
import StateMessage from '@/presentation/components/StateMessage.vue';
</script>

<template>
  <StateMessage kind="empty" title="This page does not exist" body="The link may be old or mistyped.">
    <RouterLink to="/" class="btn btn-primary">Go to Home</RouterLink>
  </StateMessage>
</template>
