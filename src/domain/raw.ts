export interface RawWord {
  readonly en?: string;
  readonly pron?: string;
  readonly desc?: string;
  readonly exam?: string;
  readonly vi?: string;
  readonly image?: string;
  readonly sound?: string;
}

export interface RawUnit {
  readonly image?: string;
  readonly en?: string;
  readonly wordlist?: readonly RawWord[];
}

export interface RawBookData {
  readonly flashcard?: readonly RawUnit[];
}
