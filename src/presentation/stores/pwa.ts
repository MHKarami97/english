import { ref } from 'vue';
import { defineStore } from 'pinia';
import { registerSW } from 'virtual:pwa-register';

export const usePwaStore = defineStore('pwa', () => {
  const needRefresh = ref(false);
  const offlineReady = ref(false);
  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

  function init(): void {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        needRefresh.value = true;
      },
      onOfflineReady: () => {
        offlineReady.value = true;
      },
    });
  }

  async function applyUpdate(): Promise<void> {
    await updateServiceWorker?.(true);
  }

  function dismiss(): void {
    needRefresh.value = false;
    offlineReady.value = false;
  }

  return { needRefresh, offlineReady, init, applyUpdate, dismiss };
});
