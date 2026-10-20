import { ReviewScopeE } from '../../types/reviews';

/** Deliberately excludes examples, grammar, generation and provenance metadata. */
export const reviewContent = (
  scope: ReviewScopeE,
  word: { word: string; part_of_speech: string },
  target: {
    title?: string;
    definition?: string;
    language?: string;
    description?: string;
    variants_of_words?: string[];
  },
  meaning?: { title: string; definition: string },
): string =>
  JSON.stringify([
    word.word,
    word.part_of_speech,
    ...(scope === ReviewScopeE.definition
      ? [target.title, target.definition]
      : scope === ReviewScopeE.meaning_translation
        ? [
            meaning?.title,
            meaning?.definition,
            target.language,
            target.title,
            target.definition,
            target.variants_of_words ?? [],
          ]
        : [target.language, target.description, target.variants_of_words ?? []]),
  ]);
