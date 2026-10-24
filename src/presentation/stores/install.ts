import { ref } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import { decideInstallUi, type InstallUi } from '@/domain/install/installState';

export const useInstallStore = defineStore('install', () => {
  const ui = ref<InstallUi>('none');
  let started = false;

  function refresh(): void {
    ui.value = decideInstallUi({
      standalone: container.install.isStandalone(),
      promptAvailable: container.install.available,
      iosSafari: container.install.isIosSafari(),
      dismissed: false,
    });
  }

  function init(): void {
    if (started) return;
    started = true;
    container.install.onChange(refresh);
    refresh();
  }

  async function install(): Promise<void> {
    await container.install.prompt();
    refresh();
  }

  return { ui, init, install };
});
