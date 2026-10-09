import { BadRequestException } from '@nestjs/common';
import { registerDecorator } from 'class-validator';
import { EntityManager } from 'typeorm';
import type { PronunciationAudioT } from '../../../../types';
import { validOriginLicense } from '../../../core/utils/provenance';
import { EnPronunciationAudio } from '../entities/en_pronunciation_audio.entity';

export type AudioInputT = PronunciationAudioT & { id?: number };
export const isAudioUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
export const validAudioLicenses = (value: unknown): boolean =>
  Array.isArray(value) && value.length <= 30 && value.every(validOriginLicense);
export const IsAudioLicenses = (): PropertyDecorator => (target, property) => {
  registerDecorator({
    name: 'isAudioLicenses',
    target: target.constructor,
    propertyName: String(property),
    validator: { validate: validAudioLicenses, defaultMessage: () => 'Invalid audio licenses' },
  });
};

/** Stable portable shape; neither database IDs nor the text's licenses can leak into it. */
export const portableAudio = (audio: PronunciationAudioT): PronunciationAudioT => ({
  url: audio.url,
  source_url: audio.source_url ?? null,
  attribution: audio.attribution ?? null,
  licenses: (audio.licenses ?? []).map(({ name, url, spdx, text }) => ({
    name,
    url,
    ...(spdx !== undefined && { spdx }),
    ...(text !== undefined && { text }),
  })),
  sort_order: audio.sort_order,
});
export const orderedAudio = <T extends PronunciationAudioT>(values: readonly T[]): T[] =>
  [...values].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      JSON.stringify(portableAudio(a)).localeCompare(JSON.stringify(portableAudio(b)), 'en'),
  );

export function validateAudio(values: readonly AudioInputT[]): void {
  if (
    !Array.isArray(values) ||
    values.length > 1000 ||
    values.some(
      (value) =>
        !value ||
        !isAudioUrl(value.url) ||
        (value.source_url != null && !isAudioUrl(value.source_url)) ||
        (value.attribution != null &&
          (typeof value.attribution !== 'string' || value.attribution.length > 10000)) ||
        !validAudioLicenses(value.licenses) ||
        !Number.isSafeInteger(value.sort_order) ||
        value.sort_order < 0 ||
        value.sort_order > 2147483647,
    )
  )
    throw new BadRequestException('Invalid pronunciation audio');
}

export async function saveAudio(
  em: EntityManager,
  pronunciationId: number,
  values: readonly AudioInputT[],
  editing: boolean,
): Promise<EnPronunciationAudio[]> {
  validateAudio(values);
  const repo = em.getRepository(EnPronunciationAudio);
  const existing = await repo.find({ where: { pronunciation: { id: pronunciationId } } });
  const keep = new Set<number>();
  if (editing)
    for (const value of values)
      if (value.id !== undefined) {
        if (keep.has(value.id) || !existing.some((row) => row.id === value.id))
          throw new BadRequestException('Audio does not belong to this pronunciation or is repeated');
        keep.add(value.id);
      }
  const removed = existing.filter((row) => !keep.has(row.id));
  if (removed.length) await repo.delete(removed.map((row) => row.id));
  return repo.save(
    repo.create(
      values.map((value) => ({
        ...portableAudio(value),
        ...(editing && value.id !== undefined && { id: value.id }),
        pronunciation: { id: pronunciationId },
      })),
    ),
  );
}
