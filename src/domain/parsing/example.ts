import type { ExampleSegment } from '../entities';

const STRONG_TAG = /<strong>([\s\S]*?)<\/strong>/gi;
const ANY_TAG = /<[^>]*>/g;
const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

const toPlainText = (fragment: string): string =>
  fragment
    .replace(ANY_TAG, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

/** Only <strong> is honoured; every other tag is dropped so the result is safe to render as text. */
export function parseExample(raw: string): readonly ExampleSegment[] {
  const segments: ExampleSegment[] = [];
  const push = (text: string, highlight: boolean): void => {
    if (text) segments.push({ text, highlight });
  };

  let cursor = 0;
  for (const match of raw.matchAll(STRONG_TAG)) {
    const start = match.index ?? 0;
    push(toPlainText(raw.slice(cursor, start)), false);

    const inner = toPlainText(match[1] ?? '');
    const core = inner.trim();
    if (core) {
      // Source markup puts the space inside the tag ("<strong>afraid </strong>"); keep it outside the highlight.
      const offset = inner.indexOf(core);
      push(inner.slice(0, offset), false);
      push(core, true);
      push(inner.slice(offset + core.length), false);
    } else {
      push(inner, false);
    }
    cursor = start + match[0].length;
  }
  push(toPlainText(raw.slice(cursor)), false);
  return segments;
}
