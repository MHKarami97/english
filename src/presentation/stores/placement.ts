import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type {
  PlacementApplied,
  PlacementPreview,
  PlacementTestService,
  PlacementView,
} from '@/application/PlacementTestService';

export const usePlacementStore = defineStore('placement', () => {
  const view = shallowRef<PlacementView | null>(null);
  const preview = shallowRef<PlacementPreview | null>(null);
  const applied = shallowRef<PlacementApplied | null>(null);
  const canUndo = ref(false);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let service: PlacementTestService | null = null;

  async function start(bookId: string): Promise<void> {
    status.value = 'loading';
    applied.value = null;
    preview.value = null;
    try {
      service = container.createPlacement();
      view.value = await service.start(bookId);
      await refreshPreview();
      status.value = 'ready';
    } catch {
      status.value = 'error';
    }
  }

  async function answer(optionId: string): Promise<void> {
    if (!service) return;
    view.value = await service.answer(optionId);
    await refreshPreview();
  }

  async function refreshPreview(): Promise<void> {
    const outcome = view.value?.outcome;
    if (service && outcome) preview.value = await service.preview(outcome);
  }

  async function apply(markEarlierKnown: boolean): Promise<void> {
    const outcome = view.value?.outcome;
    if (!service || !outcome) return;
    applied.value = await service.apply(outcome, markEarlierKnown);
    canUndo.value = await service.hasUndo();
    await refreshPreview();
  }

  async function undo(): Promise<void> {
    if (!service || !(await service.undo())) return;
    applied.value = null;
    canUndo.value = false;
    await refreshPreview();
  }

  return { view, preview, applied, canUndo, status, start, answer, apply, undo };
});
