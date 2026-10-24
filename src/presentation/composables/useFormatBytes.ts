import { useI18n } from 'vue-i18n';

export function useFormatBytes(): (bytes: number) => string {
  const { t, n } = useI18n();
  const fixed = (value: number): string => n(value, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return (bytes: number): string => {
    if (bytes >= 1024 ** 3) return t('settings.storage.gb', { n: fixed(bytes / 1024 ** 3) });
    if (bytes >= 1024 ** 2) return t('settings.storage.mb', { n: fixed(bytes / 1024 ** 2) });
    return t('settings.storage.kb', { n: n(Math.max(1, Math.round(bytes / 1024))) });
  };
}
