import type { ContentPack, LoadedContent } from '@/domain/contracts';
import type { BookRef } from '@/domain/entities';
import type { RawBookData } from '@/domain/raw';

async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Insecure contexts have no SubtleCrypto; FNV-1a is enough for change detection.
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return `fnv-${hash.toString(16)}`;
}

export class HttpContentPack implements ContentPack {
  constructor(
    readonly book: BookRef,
    private readonly baseUrl: string = import.meta.env.BASE_URL,
  ) {}

  async load(signal?: AbortSignal): Promise<LoadedContent> {
    const response = await fetch(`${this.baseUrl}${this.book.path}/data.json`, { signal });
    if (!response.ok) throw new Error(`Could not load ${this.book.id} (HTTP ${response.status})`);
    const text = await response.text();
    return { raw: JSON.parse(text) as RawBookData, hash: await hashText(text) };
  }
}
