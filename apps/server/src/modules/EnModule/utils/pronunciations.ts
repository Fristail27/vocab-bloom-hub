import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EnAreaVariantsE, PronunciationT } from '../../../../types';
import { EnPronunciation } from '../entities/en_pronunciation.entity';
import { EnWord } from '../entities/en_word.entity';

export type PronunciationInputT = PronunciationT & { id?: number };

/** Stable for tied orders too, without depending on database IDs. */
export const orderedPronunciations = <T extends PronunciationT>(values: readonly T[]): T[] =>
  [...values].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      `${a.type}\0${a.area_variant}\0${a.text ?? ''}`.localeCompare(
        `${b.type}\0${b.area_variant}\0${b.text ?? ''}`,
        'en',
      ),
  );

export const storedPronunciations = (word: EnWord): PronunciationT[] =>
  orderedPronunciations(word.pronunciations ?? []).map(({ type, text, area_variant, sort_order }) => ({
    type,
    text,
    area_variant,
    sort_order,
  }));

export const adminPronunciations = (word: EnWord): PronunciationInputT[] =>
  orderedPronunciations(word.pronunciations ?? [])
    .filter((value) => value.text?.trim())
    .map(({ id, type, text, area_variant, sort_order }) => ({ id, type, text, area_variant, sort_order }));

/** Only public reads inherit; exports, history and editable admin payloads keep ownership. */
export function pronunciationsOf(word: EnWord, base?: EnWord | null): PronunciationT[] {
  const own = storedPronunciations(word).filter((value) => value.text?.trim());
  if (own.length) return own;
  if (word.transcription?.trim())
    return [
      {
        type: 'ipa',
        text: word.transcription,
        area_variant: word.area_variant ?? EnAreaVariantsE.common,
        sort_order: 0,
      },
    ];
  return base ? pronunciationsOf(base) : [];
}

/** Keep the converter's established preference: American IPA, British IPA, first remaining IPA. */
export function primaryIPA(values: readonly PronunciationT[] = []): string {
  const ipa = orderedPronunciations(values).filter((value) => value.type === 'ipa' && value.text?.trim());
  return (
    (
      ipa.find((value) => value.area_variant === EnAreaVariantsE.american) ??
      ipa.find((value) => value.area_variant === EnAreaVariantsE.british) ??
      ipa[0]
    )?.text ?? ''
  );
}

export function validatePronunciations(values: readonly PronunciationInputT[]): void {
  if (
    !Array.isArray(values) ||
    values.some(
      (value) =>
        !value ||
        !['ipa', 'enpr'].includes(value.type) ||
        typeof value.text !== 'string' ||
        !value.text.trim() ||
        !Object.values(EnAreaVariantsE).includes(value.area_variant) ||
        !Number.isSafeInteger(value.sort_order) ||
        value.sort_order < 0 ||
        value.sort_order > 2147483647,
    )
  )
    throw new BadRequestException(
      'Invalid pronunciation: type, nonempty text, region and nonnegative order required',
    );
}

/** IDs are accepted only when editing their owner; copying/importing always allocates new IDs. */
export async function savePronunciations(
  em: EntityManager,
  wordId: number,
  values: readonly PronunciationInputT[],
  editing = false,
): Promise<EnPronunciation[]> {
  validatePronunciations(values);
  const repo = em.getRepository(EnPronunciation);
  const existing = await repo.find({ where: { word: { id: wordId } } });
  const keep = new Set<number>();
  if (editing)
    for (const value of values)
      if (value.id !== undefined) {
        if (keep.has(value.id) || !existing.some((row) => row.id === value.id))
          throw new BadRequestException('Pronunciation does not belong to this word or is repeated');
        keep.add(value.id);
      }
  const removed = existing.filter((row) => !keep.has(row.id));
  if (removed.length) await repo.delete(removed.map((row) => row.id));
  const rows = await repo.save(
    repo.create(
      values.map(({ type, text, area_variant, sort_order, id }) => ({
        ...(editing && id !== undefined && { id }),
        word: { id: wordId },
        type,
        text,
        area_variant,
        sort_order,
      })),
    ),
  );
  return rows;
}
