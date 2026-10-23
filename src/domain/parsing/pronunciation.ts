import type { Pronunciation } from '../entities';

const IPA_PREFIX = /^\s*(\[[^\]]*\]|\/[^/]*\/)\s*/;

/** Splits "[əˈfreid] adj." into { ipa: "[əˈfreid]", pos: "adj." }; brackets are always kept. */
export function parsePronunciation(raw: string | null | undefined): Pronunciation {
  const text = (raw ?? '').trim();
  const match = IPA_PREFIX.exec(text);
  const rest = match ? text.slice(match[0].length) : text;
  return { ipa: match?.[1] ?? '', pos: rest.replace(/\s+/g, ' ').trim() };
}

/** "adj./adv." and "n. v." both yield individual tags usable as filters. */
export function splitPos(pos: string): readonly string[] {
  return pos
    .split(/[\s,;/]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
