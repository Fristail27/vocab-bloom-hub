import { EntityManager, In } from 'typeorm';
import { EnWord } from '../entities/en_word.entity';
import { EnEntry } from '../entities/en_entry.entity';
import { EnWordFormsE } from '../../../../types';

/**
 * Of the given spellings, returns those that are headwords of a base-form
 * entry (a word, phrase or pattern in its dictionary form). Inflected forms
 * such as "ran" have an `en_entries` row too, but they never qualify as a
 * link target (synonym or antonym).
 */
export const findBaseFormHeadwords = async (
  em: EntityManager,
  words: readonly string[],
): Promise<Set<string>> => {
  if (words.length === 0) return new Set();
  const rows = await em
    .getRepository(EnWord)
    .createQueryBuilder('w')
    .innerJoin('w.word', 'entry')
    .select('entry.word', 'word')
    .distinct(true)
    .where('entry.word IN (:...words)', { words: [...words] })
    .andWhere('w.form_of_word = :baseForm', { baseForm: EnWordFormsE.base_form })
    .getRawMany<{ word: string }>();
  return new Set(rows.map((r) => r.word));
};

/**
 * Spellings of the same lexeme the dictionary may hold instead of the given
 * one, in the order they are tried: hyphen ↔ space, hyphen dropped, a leading
 * article or "to" dropped. Particles are never dropped ("put up with" is not
 * "put up").
 */
export const spellingVariants = (word: string): string[] => {
  const variants: string[] = [];
  if (word.includes('-')) variants.push(word.replace(/-/g, ' '), word.replace(/-/g, ''));
  if (word.includes(' ')) variants.push(word.replace(/ /g, '-'));
  const stripped = word.replace(/^(a|an|the|to) /, '');
  if (stripped !== word) variants.push(stripped);
  return [...new Set(variants)].filter((v) => v && v !== word);
};

/**
 * Maps each given spelling to the base-form headword it names: the spelling
 * itself when the dictionary has it, otherwise the first of its spelling
 * variants that it has. Spellings naming no headword are absent from the map.
 */
export const resolveBaseFormHeadwords = async (
  em: EntityManager,
  words: readonly string[],
): Promise<Map<string, string>> => {
  const candidates = new Map<string, string[]>(words.map((w) => [w, [w, ...spellingVariants(w)]]));
  const found = await findBaseFormHeadwords(em, [...new Set([...candidates.values()].flat())]);
  const resolved = new Map<string, string>();
  for (const [word, options] of candidates) {
    const hit = options.find((o) => found.has(o));
    if (hit !== undefined) resolved.set(word, hit);
  }
  return resolved;
};

/** Loads the entry rows of the given base-form headwords, in the given order */
export const loadEntries = async (em: EntityManager, words: readonly string[]): Promise<EnEntry[]> => {
  if (words.length === 0) return [];
  const entries = await em.getRepository(EnEntry).find({ where: { word: In([...words]) } });
  const byWord = new Map(entries.map((e) => [e.word, e]));
  return words.map((w) => byWord.get(w)).filter((e): e is EnEntry => e !== undefined);
};
