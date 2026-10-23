import type { MediaAvailability } from '@/application/MediaAvailability';
import type { Word } from '@/domain/entities';
import type { MediaUrlResolver } from './MediaUrlResolver';

async function probe(url: string): Promise<boolean> {
  try {
    if ('caches' in globalThis && (await caches.match(url))) return true;
    if (!navigator.onLine) return false;
    // A plain GET lets the service worker cache the whole file for later range requests.
    const response = await fetch(url);
    void response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

export class BrowserMediaAvailability implements MediaAvailability {
  private readonly results = new Map<string, Promise<boolean>>();

  constructor(private readonly media: MediaUrlResolver) {}

  isAudioAvailable(word: Word): Promise<boolean> {
    return this.check(this.media.audio(word));
  }

  isImageAvailable(word: Word): Promise<boolean> {
    return this.check(this.media.wordImage(word));
  }

  private check(url: string | null): Promise<boolean> {
    if (!url) return Promise.resolve(false);
    let result = this.results.get(url);
    if (!result) {
      result = probe(url);
      this.results.set(url, result);
      // A failure may only mean "offline right now", so it is probed again next time.
      void result.then((available) => {
        if (!available) this.results.delete(url);
      });
    }
    return result;
  }
}
