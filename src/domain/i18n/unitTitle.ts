const UNIT_TITLE = /^Unit\s+(\d+)$/i;

export function parseUnitNumber(title: string): number | null {
  const digits = UNIT_TITLE.exec(title.trim())?.[1];
  return digits === undefined ? null : Number(digits);
}
