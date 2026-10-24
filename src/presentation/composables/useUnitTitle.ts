import { useI18n } from 'vue-i18n';
import { parseUnitNumber } from '@/domain/i18n/unitTitle';

export function useUnitTitle(): (title: string) => string {
  const { t } = useI18n();
  return (title) => {
    const number = parseUnitNumber(title);
    return number === null ? title : t('unit.title', { n: number });
  };
}
