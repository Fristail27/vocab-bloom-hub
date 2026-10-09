import { orderedAudio, portableAudio, validateAudio, saveAudio } from './pronunciationAudio';
import type { AdminPronunciationT } from '../../../../types';
import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EnAreaVariantsE, PronunciationT } from '../../../../types';
import { EnPronunciation } from '../entities/en_pronunciation.entity';
import { EnWord } from '../entities/en_word.entity';

export type PronunciationInputT = AdminPronunciationT;

/** Stable for tied orders too, without depending on database IDs. */
export const orderedPronunciations = <T extends PronunciationT>(values: readonly T[]): T[] =>
  [...values].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      `${a.type}\0${a.area_variant}\0${a.text ?? ''}`.localeCompare(
        `${b.type}\0${b.area_variant}\0${b.text ?? ''}`,
        'en',
      ) ||
      JSON.stringify(orderedAudio(a.audio ?? []).map(portableAudio)).localeCompare(
        JSON.stringify(orderedAudio(b.audio ?? []).map(portableAudio)),
        'en',
      ),
  );

export const storedPronunciations = (word: EnWord): PronunciationT[] =>
  orderedPronunciations(word.pronunciations ?? []).map(({ type, text, area_variant, sort_order, audio }) => ({
    ...(audio?.length && { audio: orderedAudio(audio).map(portableAudio) }),
    type,
    text,
    area_variant,
    sort_order,
  }));

export const adminPronunciations = (word: EnWord): PronunciationInputT[] =>
  orderedPronunciations(word.pronunciations ?? [])
    .filter((value) => value.text?.trim() || value.audio?.length)
    .map(({ id, type, text, area_variant, sort_order, audio }) => ({
      id,
      type,
      text,
      area_variant,
      sort_order,
      ...(audio?.length && {
        audio: orderedAudio(audio).map((value) => ({ id: value.id, ...portableAudio(value) })),
      }),
    }));

/** Only public reads inherit; exports, history and editable admin payloads keep ownership. */
export function pronunciationsOf(word: EnWord, base?: EnWord | null): PronunciationT[] {
  const own = storedPronunciations(word).filter((value) => value.text?.trim() || value.audio?.length);
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
        !(
          (typeof value.text === 'string' && value.text.trim()) ||
          (value.text === null && value.audio?.length)
        ) ||
        !Object.values(EnAreaVariantsE).includes(value.area_variant) ||
        !Number.isSafeInteger(value.sort_order) ||
        value.sort_order < 0 ||
        value.sort_order > 2147483647,
    )
  )
    throw new BadRequestException(
      'Invalid pronunciation: type, text or audio, region and nonnegative order required',
    );
  for (const value of values) if (value.audio !== undefined) validateAudio(value.audio);
}

/** IDs are accepted only when editing their owner; copying/importing always allocates new IDs. */
export async function savePronunciations(
  em: EntityManager,
  wordId: number,
  values: readonly PronunciationInputT[],
  editing = false,
): Promise<EnPronunciation[]> {
  if (!Array.isArray(values) || values.some((value) => !value || typeof value !== 'object'))
    throw new BadRequestException('Invalid pronunciations');
  const repo = em.getRepository(EnPronunciation);
  const existing = await repo.find({ where: { word: { id: wordId } }, relations: { audio: true } });
  const keep = new Set<number>();
  if (editing)
    for (const value of values)
      if (value.id !== undefined) {
        if (keep.has(value.id) || !existing.some((row) => row.id === value.id))
          throw new BadRequestException('Pronunciation does not belong to this word or is repeated');
        keep.add(value.id);
      }
  // A legacy client editing a surviving pronunciation may not know about audio.
  const effective = values.map((value) => ({
    ...value,
    ...(editing &&
      value.id !== undefined &&
      value.audio === undefined && {
        audio: existing.find((row) => row.id === value.id)?.audio,
      }),
  }));
  validatePronunciations(effective);
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
  for (const [index, row] of rows.entries()) {
    if (values[index].audio !== undefined)
      row.audio = await saveAudio(em, row.id, values[index].audio!, editing);
    else row.audio = effective[index].audio as EnPronunciation['audio'];
  }
  return rows;
}
