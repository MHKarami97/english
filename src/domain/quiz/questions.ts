export type QuestionType =
  | 'mcq-definition-to-word'
  | 'mcq-word-to-definition'
  | 'mcq-image-to-word'
  | 'mcq-word-to-image'
  | 'cloze-choice'
  | 'cloze-typing'
  | 'dictation'
  | 'matching';

export interface ChoiceOption {
  readonly id: string;
  readonly text?: string;
  /** Option shown as the picture of this word. */
  readonly imageWordId?: string;
}

interface QuestionBase {
  readonly id: string;
  readonly wordId: string;
  /** Human-readable correct answer, shown in feedback. */
  readonly answerLabel: string;
}

export interface ChoiceBase extends QuestionBase {
  readonly options: readonly ChoiceOption[];
  readonly correctOptionId: string;
}

export interface McqDefinitionToWord extends ChoiceBase {
  readonly type: 'mcq-definition-to-word';
  readonly prompt: string;
}

export interface McqWordToDefinition extends ChoiceBase {
  readonly type: 'mcq-word-to-definition';
  readonly prompt: string;
}

export interface McqImageToWord extends ChoiceBase {
  readonly type: 'mcq-image-to-word';
  readonly promptImageWordId: string;
}

export interface McqWordToImage extends ChoiceBase {
  readonly type: 'mcq-word-to-image';
  readonly prompt: string;
}

export interface ClozeChoice extends ChoiceBase {
  readonly type: 'cloze-choice';
  readonly before: string;
  readonly after: string;
  readonly hint: string;
}

export interface ClozeTyping extends QuestionBase {
  readonly type: 'cloze-typing';
  readonly before: string;
  readonly after: string;
  readonly hint: string;
  /** The headword, accepted with a "check the form" note when the sentence uses an inflected form. */
  readonly alternative: string | null;
}

export interface Dictation extends QuestionBase {
  readonly type: 'dictation';
  readonly audioWordId: string;
}

export interface MatchingPair {
  readonly wordId: string;
  readonly label: string;
  readonly definition: string;
}

export interface MatchingQuestion {
  readonly id: string;
  readonly type: 'matching';
  readonly variant: 'definition' | 'image';
  readonly pairs: readonly MatchingPair[];
  readonly leftOrder: readonly string[];
  readonly rightOrder: readonly string[];
}

export type ChoiceQuestion = McqDefinitionToWord | McqWordToDefinition | McqImageToWord | McqWordToImage | ClozeChoice;
export type TypingQuestion = ClozeTyping | Dictation;
export type Question = ChoiceQuestion | TypingQuestion;
export type AnyQuestion = Question | MatchingQuestion;

export const isChoiceQuestion = (question: Question): question is ChoiceQuestion => 'options' in question;
