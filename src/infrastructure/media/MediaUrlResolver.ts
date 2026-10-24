import type { BookRef, Unit, Word } from '@/domain/entities';
import type { MediaLocator } from '@/domain/download/ports';

export class MediaUrlResolver implements MediaLocator {
  private readonly paths = new Map<string, string>();

  constructor(private readonly baseUrl: string = import.meta.env.BASE_URL) {}

  register(books: readonly BookRef[]): void {
    books.forEach((book) => this.paths.set(book.id, book.path));
  }

  audio(word: Word): string | null {
    return this.resolve(word.bookId, 'audio', word.sound);
  }

  wordImage(word: Word): string | null {
    return this.resolve(word.bookId, 'images', word.image);
  }

  unitImage(unit: Unit): string | null {
    return this.resolve(unit.bookId, 'images', unit.image);
  }

  preloadImage(url: string | null): void {
    if (!url) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  }

  /** Absolute url of a manifest path such as "audio/apple.mp3"; the same url the player requests. */
  fileUrl(bookId: string, relativePath: string): string | null {
    const path = this.paths.get(bookId);
    if (!path || !relativePath) return null;
    const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
    return new URL(`${this.baseUrl}${path}/${encoded}`, document.baseURI).href;
  }

  bookPrefix(bookId: string): string | null {
    const path = this.paths.get(bookId);
    return path ? new URL(`${this.baseUrl}${path}/`, document.baseURI).href : null;
  }

  private resolve(bookId: string, folder: 'audio' | 'images', file: string): string | null {
    const path = this.paths.get(bookId);
    return path && file ? `${this.baseUrl}${path}/${folder}/${encodeURIComponent(file)}` : null;
  }
}
