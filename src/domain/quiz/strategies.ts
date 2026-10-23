import type { Word } from '../entities';
import { shuffle, type RandomSource } from '../random';
import { buildCloze } from './cloze';
import type { DistractorSelector, OptionKind } from './distractors';
import {
  DefaultAnswerNormalizer,
  gradeOutcome,
  gradeTyped,
  type AnswerNormalizer,
  type Grade,
  type GradeOptions,
} from './grading';
import type {
  ChoiceOption,
  ChoiceQuestion,
  ClozeChoice,
  ClozeTyping,
  Dictation,
  McqDefinitionToWord,
  McqImageToWord,
  McqWordToDefinition,
  McqWordToImage,
  Question,
} from './questions';

export interface BuildContext {
  readonly selector: DistractorSelector;
  readonly random: RandomSource;
  readonly optionCount: number;
}

/** Strategy: builds and grades exactly one question type. */
export interface QuizStrategy<Q extends Question = Question> {
  readonly type: Q['type'];
  canBuild(word: Word): boolean;
  build(word: Word, context: BuildContext): Promise<Q>;
  grade(question: Q, answer: string, options: GradeOptions): Grade;
}

const optionFor = (kind: OptionKind, word: Word): ChoiceOption =>
  kind === 'word'
    ? { id: word.id, text: word.word }
    : kind === 'definition'
      ? { id: word.id, text: word.definition }
      : { id: word.id, imageWordId: word.id };

abstract class ChoiceStrategy<Q extends ChoiceQuestion> implements QuizStrategy<Q> {
  abstract readonly type: Q['type'];
  protected abstract readonly kind: OptionKind;
  abstract canBuild(word: Word): boolean;
  protected abstract compose(word: Word, options: readonly ChoiceOption[]): Q;

  async build(word: Word, context: BuildContext): Promise<Q> {
    const distractors = await context.selector.select(word, this.kind, context.optionCount - 1);
    const options = shuffle([word, ...distractors], context.random).map((candidate) => optionFor(this.kind, candidate));
    return this.compose(word, options);
  }

  grade(question: Q, answer: string): Grade {
    return gradeOutcome(answer === question.correctOptionId ? 'correct' : 'wrong', question.answerLabel);
  }
}

export class McqDefinitionToWordStrategy extends ChoiceStrategy<McqDefinitionToWord> {
  readonly type = 'mcq-definition-to-word';
  protected readonly kind = 'word';
  canBuild(word: Word): boolean {
    return word.definition.length > 0;
  }
  protected compose(word: Word, options: readonly ChoiceOption[]): McqDefinitionToWord {
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: word.word, prompt: word.definition, options, correctOptionId: word.id };
  }
}

export class McqWordToDefinitionStrategy extends ChoiceStrategy<McqWordToDefinition> {
  readonly type = 'mcq-word-to-definition';
  protected readonly kind = 'definition';
  canBuild(word: Word): boolean {
    return word.definition.length > 0;
  }
  protected compose(word: Word, options: readonly ChoiceOption[]): McqWordToDefinition {
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: word.definition, prompt: word.word, options, correctOptionId: word.id };
  }
}

export class McqImageToWordStrategy extends ChoiceStrategy<McqImageToWord> {
  readonly type = 'mcq-image-to-word';
  protected readonly kind = 'word';
  canBuild(word: Word): boolean {
    return word.image.length > 0;
  }
  protected compose(word: Word, options: readonly ChoiceOption[]): McqImageToWord {
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: word.word, promptImageWordId: word.id, options, correctOptionId: word.id };
  }
}

export class McqWordToImageStrategy extends ChoiceStrategy<McqWordToImage> {
  readonly type = 'mcq-word-to-image';
  protected readonly kind = 'image';
  canBuild(word: Word): boolean {
    return word.image.length > 0;
  }
  protected compose(word: Word, options: readonly ChoiceOption[]): McqWordToImage {
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: word.word, prompt: word.word, options, correctOptionId: word.id };
  }
}

export class ClozeChoiceStrategy extends ChoiceStrategy<ClozeChoice> {
  readonly type = 'cloze-choice';
  protected readonly kind = 'word';
  /** Options are headwords, so an inflected blank would give the answer away; typing handles those. */
  canBuild(word: Word): boolean {
    const parts = buildCloze(word);
    return parts !== null && !parts.inflected;
  }
  protected compose(word: Word, options: readonly ChoiceOption[]): ClozeChoice {
    const parts = buildCloze(word);
    if (!parts) throw new Error(`No cloze for ${word.id}`);
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: parts.answer, before: parts.before, after: parts.after, hint: word.definition, options, correctOptionId: word.id };
  }
}

export class ClozeTypingStrategy implements QuizStrategy<ClozeTyping> {
  readonly type = 'cloze-typing';
  constructor(private readonly normalizer: AnswerNormalizer = new DefaultAnswerNormalizer()) {}

  canBuild(word: Word): boolean {
    return buildCloze(word) !== null;
  }

  async build(word: Word): Promise<ClozeTyping> {
    const parts = buildCloze(word);
    if (!parts) throw new Error(`No cloze for ${word.id}`);
    return {
      id: `${this.type}:${word.id}`,
      type: this.type,
      wordId: word.id,
      answerLabel: parts.answer,
      before: parts.before,
      after: parts.after,
      hint: word.definition,
      alternative: parts.inflected ? parts.headword : null,
    };
  }

  grade(question: ClozeTyping, answer: string, options: GradeOptions): Grade {
    return gradeTyped(answer, { answer: question.answerLabel, alternative: question.alternative ?? undefined }, options, this.normalizer);
  }
}

export class DictationStrategy implements QuizStrategy<Dictation> {
  readonly type = 'dictation';
  constructor(private readonly normalizer: AnswerNormalizer = new DefaultAnswerNormalizer()) {}

  canBuild(word: Word): boolean {
    return word.sound.length > 0;
  }

  async build(word: Word): Promise<Dictation> {
    return { id: `${this.type}:${word.id}`, type: this.type, wordId: word.id, answerLabel: word.word, audioWordId: word.id };
  }

  grade(question: Dictation, answer: string, options: GradeOptions): Grade {
    return gradeTyped(answer, { answer: question.answerLabel }, options, this.normalizer);
  }
}

export class UnknownQuestionTypeError extends Error {
  constructor(type: string) {
    super(`No strategy is registered for question type "${type}"`);
    this.name = 'UnknownQuestionTypeError';
  }
}

/** Factory: finds the strategy for a requested question type. */
export class QuestionFactory {
  constructor(private readonly strategies: readonly QuizStrategy[]) {}

  canCreate(type: Question['type'], word: Word): boolean {
    return this.find(type)?.canBuild(word) ?? false;
  }

  create(type: Question['type'], word: Word, context: BuildContext): Promise<Question> {
    return this.strategyFor(type).build(word, context);
  }

  grade(question: Question, answer: string, options: GradeOptions): Grade {
    return this.strategyFor(question.type).grade(question, answer, options);
  }

  private find(type: string): QuizStrategy | undefined {
    return this.strategies.find((strategy) => strategy.type === type);
  }

  private strategyFor(type: string): QuizStrategy {
    const strategy = this.find(type);
    if (!strategy) throw new UnknownQuestionTypeError(type);
    return strategy;
  }
}

export function createDefaultQuestionFactory(normalizer: AnswerNormalizer = new DefaultAnswerNormalizer()): QuestionFactory {
  return new QuestionFactory([
    new McqDefinitionToWordStrategy(),
    new McqWordToDefinitionStrategy(),
    new McqImageToWordStrategy(),
    new McqWordToImageStrategy(),
    new ClozeChoiceStrategy(),
    new ClozeTypingStrategy(normalizer),
    new DictationStrategy(normalizer),
  ]);
}
