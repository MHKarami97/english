import type { LocationQuery } from 'vue-router';
import type { PracticeScope, QuizMode } from '@/domain/quiz/models';

export type ModeId = QuizMode | 'matching';
export type ScopeKind = 'units' | 'book' | 'favorites' | 'unknown' | 'due';

export const PRACTICE_MODES: readonly { readonly id: ModeId }[] = [
  { id: 'mixed' },
  { id: 'mcq' },
  { id: 'pictures' },
  { id: 'cloze' },
  { id: 'dictation' },
  { id: 'timed' },
  { id: 'matching' },
];

export const SCOPE_OPTIONS: readonly { readonly kind: ScopeKind }[] = [
  { kind: 'book' },
  { kind: 'units' },
  { kind: 'favorites' },
  { kind: 'unknown' },
  { kind: 'due' },
];

export function buildScope(kind: ScopeKind, unitIds: readonly string[]): PracticeScope {
  return kind === 'units' ? { kind: 'units', unitIds } : { kind };
}

export function scopeToQuery(scope: PracticeScope): Record<string, string> {
  return scope.kind === 'units' ? { scope: 'units', units: scope.unitIds.join(',') } : { scope: scope.kind };
}

export function scopeFromQuery(query: LocationQuery): PracticeScope {
  const kind = String(query.scope ?? 'book');
  switch (kind) {
    case 'units':
      return { kind: 'units', unitIds: String(query.units ?? '').split(',').filter(Boolean) };
    case 'favorites':
    case 'unknown':
    case 'due':
    case 'mistakes':
      return { kind };
    default:
      return { kind: 'book' };
  }
}

export function formatClock(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
