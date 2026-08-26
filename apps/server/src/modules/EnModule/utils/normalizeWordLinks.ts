// The relations of a meaning that link to other dictionary headwords; both
// share one storage shape (a junction table) and one set of rules
export const WORD_LINK_KINDS = ['synonyms', 'antonyms'] as const;
export type WordLinkKindT = (typeof WORD_LINK_KINDS)[number];

// Upper bound on linked words (synonyms or antonyms) per meaning; generated
// lists are usually 3–10 long
export const MAX_WORD_LINKS_PER_MEANING = 50;

/**
 * Brings an authored or generated list of linked words (synonyms, antonyms)
 * to the canonical shape stored in the database: trimmed, lowercase, without
 * blanks and duplicates, without the meaning's own headword (generated lists
 * routinely contain it), sorted by UTF-16 code units so the result does not
 * depend on the input order.
 */
export const normalizeWordLinks = (
  words: readonly string[] | null | undefined,
  headword?: string,
): string[] => {
  const self = headword?.trim().toLowerCase();
  const unique = new Set<string>();
  for (const raw of words ?? []) {
    const word = raw.trim().toLowerCase();
    if (!word || word === self) continue;
    unique.add(word);
  }
  return [...unique].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};
