<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ title: string; body: string; confirmLabel: string }>();
const emit = defineEmits<{ confirm: [] }>();

let counter = 0;
const titleId = `confirm-dialog-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;
const dialog = ref<HTMLDialogElement | null>(null);

function confirm(): void {
  emit('confirm');
  dialog.value?.close();
}

defineExpose({ open: () => dialog.value?.showModal(), close: () => dialog.value?.close() });
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-labelledby="titleId">
    <div class="p-6">
      <h2 :id="titleId" class="font-display text-xl font-semibold">{{ title }}</h2>
      <p class="mt-2 text-muted">{{ body }}</p>
      <slot />
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="btn" @click="dialog?.close()">Cancel</button>
        <button type="button" class="btn btn-primary" @click="confirm">{{ confirmLabel }}</button>
      </div>
    </div>
  </dialog>
</template>
