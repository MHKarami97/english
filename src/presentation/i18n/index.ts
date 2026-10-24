import { createI18n } from 'vue-i18n';
import { type Ref } from 'vue';
import fa from '@/locales/fa.json';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  directionOf,
  resolveInitialLocale,
  type Locale,
} from '@/domain/i18n/locale';
import { APP_NAME } from '@/config/app';

type Catalog = typeof fa;

const LAZY_CATALOGS: Partial<Record<Locale, () => Promise<{ default: Catalog }>>> = {
  en: () => import('@/locales/en.json'),
};

const i18nInstance = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: { fa },
});

const i18nLocale = i18nInstance.global.locale as unknown as Ref<Locale>;

const loaded = new Set<Locale>(['fa']);

async function ensureCatalog(locale: Locale): Promise<void> {
  if (loaded.has(locale)) return;
  const load = LAZY_CATALOGS[locale];
  if (!load) return;
  const module = await load();
  i18nInstance.global.setLocaleMessage(locale, module.default);
  loaded.add(locale);
}

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function mirrorLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in private mode; the Dexie setting remains the durable copy.
  }
}

function applyToDocument(locale: Locale): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = directionOf(locale);
  document.title = i18nInstance.global.t('meta.title', { name: APP_NAME });
}

export type { Locale };

export const i18n = i18nInstance;

export async function setLocale(locale: Locale): Promise<void> {
  await ensureCatalog(locale);
  i18nLocale.value = locale;
  mirrorLocale(locale);
  applyToDocument(locale);
}

export async function initLocale(): Promise<Locale> {
  const locale = resolveInitialLocale(readStoredLocale());
  await ensureCatalog(locale);
  await ensureCatalog(FALLBACK_LOCALE);
  i18nLocale.value = locale;
  applyToDocument(locale);
  return locale;
}