import type { BookIndexSource } from '@/domain/contracts';
import type { BookRef } from '@/domain/entities';

const isBookRef = (value: unknown): value is BookRef => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.path === 'string'
  );
};

export class HttpBookIndex implements BookIndexSource {
  constructor(private readonly baseUrl: string = import.meta.env.BASE_URL) {}

  async fetchBooks(): Promise<readonly BookRef[]> {
    const response = await fetch(`${this.baseUrl}data/books.json`);
    if (!response.ok) throw new Error(`books.json responded with HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('books.json must contain an array');
    return data.filter(isBookRef);
  }
}
