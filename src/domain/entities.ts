export type Knowledge = 'unknown' | 'known' | 'new';

export interface BookRef {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

export interface Book extends BookRef {
  readonly importedAt: number;
  readonly version: string;
}

export interface Unit {
  readonly id: string;
  readonly bookId: string;
  readonly order: number;
  readonly title: string;
  readonly image: string;
}

export interface ExampleSegment {
  readonly text: string;
  readonly highlight: boolean;
}

export interface Word {
  readonly id: string;
  readonly bookId: string;
  readonly unitId: string;
  readonly order: number;
  readonly word: string;
  readonly ipa: string;
  readonly pos: string;
  readonly definition: string;
  readonly exampleSegments: readonly ExampleSegment[];
  readonly translationFa: string;
  readonly image: string;
  readonly sound: string;
}

export interface UserWordState {
  readonly wordId: string;
  readonly bookId: string;
  readonly isFavorite: boolean;
  readonly knowledge: Knowledge;
  readonly updatedAt: number;
}

export interface Setting {
  readonly key: string;
  readonly value: unknown;
}

export interface Pronunciation {
  readonly ipa: string;
  readonly pos: string;
}
