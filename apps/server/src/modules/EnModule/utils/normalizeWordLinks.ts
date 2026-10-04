// The relations of a meaning that link to other dictionary headwords; both
// share one storage shape (a junction table) and one set of rules
export const WORD_LINK_KINDS = ['synonyms', 'antonyms'] as const;
export type WordLinkKindT = (typeof WORD_LINK_KINDS)[number];

// Upper bound on linked words (synonyms or antonyms) per meaning; generated
// lists are usually 3–10 long
export const MAX_WORD_LINKS_PER_MEANING = 50;

/** Exact headwords from a source or the database; case can distinguish words (Polish / polish). */
export const normalizeWordLinks = (
  words: readonly string[] | null | undefined,
  headword?: string,
): string[] => {
  const self = headword?.trim();
  const unique = new Set<string>();
  for (const raw of words ?? []) {
    const word = raw.trim();
    if (!word || word === self) continue;
    unique.add(word);
  }
  return [...unique].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};
