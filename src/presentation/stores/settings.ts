import { ref } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import { SettingKey } from '@/application/settingKeys';
import { setLocale, type Locale } from '@/presentation/i18n';

export type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'lexi-theme';

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(choice: ThemeChoice): void {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeChoice>(readTheme());
  const autoPlayOnFlip = ref(false);
  const uiLanguage = ref<Locale>('fa');

  async function init(): Promise<void> {
    autoPlayOnFlip.value = await container.settings.get(SettingKey.autoPlayOnFlip, false);
    const storedLocale = await container.settings.get<string | null>(SettingKey.uiLanguage, null);
    if (storedLocale === 'fa' || storedLocale === 'en') {
      uiLanguage.value = storedLocale;
      await setLocale(storedLocale);
    }
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') applyTheme('system');
    });
  }

  function setTheme(choice: ThemeChoice): void {
    theme.value = choice;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // Private mode can block storage; the theme still applies for this session.
    }
    applyTheme(choice);
  }

  async function setAutoPlay(enabled: boolean): Promise<void> {
    autoPlayOnFlip.value = enabled;
    await container.settings.set(SettingKey.autoPlayOnFlip, enabled);
  }

  async function setLanguage(locale: Locale): Promise<void> {
    uiLanguage.value = locale;
    await setLocale(locale);
    await container.settings.set(SettingKey.uiLanguage, locale);
  }

  return { theme, autoPlayOnFlip, uiLanguage, init, setTheme, setAutoPlay, setLanguage };
});
