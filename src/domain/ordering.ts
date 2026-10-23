import type { Unit, Word } from './entities';

export function sortWordsByUnitOrder(words: readonly Word[], units: readonly Unit[]): readonly Word[] {
  const rank = new Map(units.map((unit) => [unit.id, unit.order]));
  return [...words].sort(
    (a, b) => (rank.get(a.unitId) ?? 0) - (rank.get(b.unitId) ?? 0) || a.order - b.order,
  );
}
