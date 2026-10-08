import { EntityManager, In } from 'typeorm';
import { EnEntry } from '../entities/en_entry.entity';

export const alternativeSpellings = (entry: EnEntry): string[] =>
  [...new Set((entry.alternatives ?? []).map((item) => item.word))]
    .filter((word) => word !== entry.word)
    .sort();

export const normalizeAlternatives = (values: readonly string[], own: string): string[] =>
  [
    ...new Set(
      values.map((value) => value.trim()).filter((value) => value && value !== own && value.length <= 128),
    ),
  ].sort();

/**
 * Replace explicitly supplied lists as one operation, after every headword exists.
 * Lists from different parts of speech have already been unioned. A pair requested
 * by either endpoint is kept, but no transitive links are inferred. Legacy omitted
 * lists do not clear existing links. Import cannot change a protected endpoint.
 */
export async function replaceAlternatives(
  em: EntityManager,
  requested: ReadonlyMap<string, readonly string[]>,
  protectModified = false,
): Promise<void> {
  if (!requested.size) return;
  const known = new Map<string, boolean>();
  const names = [
    ...new Set(
      [...requested].flatMap(([word, alternatives]) => [word, ...normalizeAlternatives(alternatives, word)]),
    ),
  ];
  for (let i = 0; i < names.length; i += 400) {
    for (const entry of await em.find(EnEntry, {
      where: { word: In(names.slice(i, i + 400)) },
      select: { word: true, user_modified: true },
    }))
      known.set(entry.word, Boolean(entry.user_modified));
  }
  const desired = new Map<string, Set<string>>();
  for (const [word, alternatives] of requested) {
    if (!known.has(word) || (protectModified && known.get(word))) continue;
    desired.set(
      word,
      new Set(
        normalizeAlternatives(alternatives, word).filter(
          (target) => known.has(target) && !(protectModified && known.get(target)),
        ),
      ),
    );
  }
  const owners = [...desired.keys()];
  for (let i = 0; i < owners.length; i += 400) {
    const entries = await em.find(EnEntry, {
      where: { word: In(owners.slice(i, i + 400)) },
      relations: { alternatives: true },
    });
    for (const entry of entries) {
      for (const other of entry.alternatives ?? []) {
        if (
          (protectModified && other.user_modified) ||
          desired.get(entry.word)?.has(other.word) ||
          desired.get(other.word)?.has(entry.word)
        )
          continue;
        await em.createQueryBuilder().relation(EnEntry, 'alternatives').of(entry.word).remove(other.word);
        await em.createQueryBuilder().relation(EnEntry, 'alternatives').of(other.word).remove(entry.word);
      }
    }
  }
  const rows: { word: string; alternative: string }[] = [];
  for (const [word, alternatives] of desired) {
    for (const alternative of alternatives)
      rows.push({ word, alternative }, { word: alternative, alternative: word });
  }
  for (let i = 0; i < rows.length; i += 400) {
    await em
      .createQueryBuilder()
      .insert()
      .into('en_entry_alternatives')
      .values(rows.slice(i, i + 400))
      .orIgnore()
      .execute();
  }
}
