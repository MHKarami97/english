const trim = (value: number): string => Number(value.toFixed(1)).toString();

export function formatInterval(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${trim(days / 30)}mo`;
  return `${trim(days / 365)}y`;
}
