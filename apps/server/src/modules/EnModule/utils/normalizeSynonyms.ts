// Upper bound on synonyms per meaning; generated lists are usually 3–10 long
export const MAX_SYNONYMS_PER_MEANING = 50;

/**
 * Brings an authored or generated synonym list to the canonical shape stored
 * in the database: trimmed, lowercase, without blanks and duplicates, without
 * the meaning's own headword (generated lists routinely contain it), sorted by
 * UTF-16 code units so the result does not depend on the input order.
 */
export const normalizeSynonyms = (
  synonyms: readonly string[] | null | undefined,
  headword?: string,
): string[] => {
  const self = headword?.trim().toLowerCase();
  const unique = new Set<string>();
  for (const raw of synonyms ?? []) {
    const word = raw.trim().toLowerCase();
    if (!word || word === self) continue;
    unique.add(word);
  }
  return [...unique].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};
