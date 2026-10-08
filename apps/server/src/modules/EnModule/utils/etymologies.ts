import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EnEtymology } from '../entities/en_etymology.entity';
import { EnWord } from '../entities/en_word.entity';
import { EnMeaning } from '../entities/en_meaning.entity';

export type EtymologyValueT = { number: number; text: string };
export type EtymologyInputT = EtymologyValueT & { id?: number };
export const etymologiesOf = (word: EnWord): EtymologyValueT[] =>
  [...(word.etymologies ?? [])]
    .sort((a, b) => a.number - b.number)
    .map(({ number, text }) => ({ number, text }));

export function validateEtymologies(values: readonly EtymologyInputT[]): void {
  if (
    !Array.isArray(values) ||
    values.some(
      (item) =>
        !item ||
        !Number.isSafeInteger(item.number) ||
        item.number < 1 ||
        item.number > 2147483647 ||
        typeof item.text !== 'string',
    ) ||
    new Set(values.map((item) => item.number)).size !== values.length
  )
    throw new BadRequestException('Invalid etymologies: unique positive local numbers and text are required');
}

/** IDs identify surviving records during edits; renumbering never retargets a meaning. */
export async function saveEtymologies(
  em: EntityManager,
  wordId: number,
  values: readonly EtymologyInputT[],
  editing = false,
): Promise<void> {
  validateEtymologies(values);
  const repo = em.getRepository(EnEtymology);
  const existing = await repo.find({ where: { word: { id: wordId } } });
  const keep = new Set<number>();
  if (editing)
    for (const item of values)
      if (item.id !== undefined) {
        if (!existing.some((row) => row.id === item.id) || keep.has(item.id))
          throw new BadRequestException('Etymology does not belong to this word or is repeated');
        keep.add(item.id);
      }
  for (const row of existing) {
    if (!keep.has(row.id)) await repo.delete(row.id);
    else await repo.update(row.id, { number: -row.id }); // allow swaps under the unique constraint
  }
  for (const item of values)
    await repo.save({
      ...(editing && item.id !== undefined && { id: item.id }),
      word: { id: wordId },
      number: item.number,
      text: item.text,
    });
}

export async function resolveEtymology(
  em: EntityManager,
  wordId: number,
  number: number | null | undefined,
): Promise<EnEtymology | null> {
  if (number == null) return null;
  if (!Number.isSafeInteger(number) || number < 1) throw new BadRequestException('Invalid etymology number');
  const row = await em.findOne(EnEtymology, { where: { word: { id: wordId }, number } });
  if (!row) throw new BadRequestException('Etymology does not belong to this word');
  return row;
}

/** Portable history also remembers associations affected by deleting or reordering a group. */
export const etymologySnapshot = (word: EnWord) =>
  etymologiesOf(word).map((item) => ({
    ...item,
    meanings: (word.meanings ?? [])
      .filter((meaning) => meaning.etymology?.number === item.number)
      .map(({ title, sort_order }) => ({ title, sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
  }));

export async function restoreEtymologies(em: EntityManager, wordId: number, snapshot: unknown): Promise<void> {
  const values = (Array.isArray(snapshot) ? snapshot : []) as (EtymologyValueT & {
    meanings?: { title: string; sort_order: number }[];
  })[];
  await saveEtymologies(em, wordId, values);
  for (const item of values) {
    const etymology = await resolveEtymology(em, wordId, item.number);
    for (const meaning of item.meanings ?? [])
      await em.update(
        EnMeaning,
        { word: { id: wordId }, title: meaning.title, sort_order: meaning.sort_order },
        { etymology },
      );
  }
}
