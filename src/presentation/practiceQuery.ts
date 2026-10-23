import type { LocationQuery } from 'vue-router';
import type { PracticeScope, QuizMode } from '@/domain/quiz/models';

export type ModeId = QuizMode | 'matching';
export type ScopeKind = 'units' | 'book' | 'favorites' | 'unknown' | 'due';

export const PRACTICE_MODES: readonly { readonly id: ModeId; readonly title: string; readonly description: string }[] = [
  { id: 'mixed', title: 'Mixed practice', description: 'Meanings, pictures, sentences and spelling in one set.' },
  { id: 'mcq', title: 'Meaning match', description: 'Pick the word for a meaning, or the meaning for a word.' },
  { id: 'pictures', title: 'Picture quiz', description: 'Match words with their pictures.' },
  { id: 'cloze', title: 'Fill the blank', description: 'Complete the example sentence.' },
  { id: 'dictation', title: 'Dictation', description: 'Listen to a word and type it.' },
  { id: 'timed', title: 'Timed challenge', description: 'Answer as many as you can before the clock runs out.' },
  { id: 'matching', title: 'Matching game', description: 'Pair six words with meanings or pictures per round.' },
];

export const SCOPE_OPTIONS: readonly { readonly kind: ScopeKind; readonly label: string }[] = [
  { kind: 'book', label: 'Whole book' },
  { kind: 'units', label: 'Units' },
  { kind: 'favorites', label: 'Favorites' },
  { kind: 'unknown', label: 'Marked unknown' },
  { kind: 'due', label: 'Due today' },
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
