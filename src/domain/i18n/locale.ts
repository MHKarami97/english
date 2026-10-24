export const SUPPORTED_LOCALES = ['fa', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TextDirection = 'rtl' | 'ltr';

export const DEFAULT_LOCALE: Locale = 'fa';
export const FALLBACK_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'lexi-locale';

const DIRECTIONS: Record<Locale, TextDirection> = { fa: 'rtl', en: 'ltr' };

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = { fa: 'فارسی', en: 'English' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): TextDirection {
  return DIRECTIONS[locale];
}

export function resolveInitialLocale(stored: string | null | undefined): Locale {
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}
