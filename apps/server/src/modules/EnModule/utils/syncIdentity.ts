import { BadRequestException } from '@nestjs/common';

/** Optional portable metadata. Admin DTOs do not expose it as an editable field. */
export const syncIdentity = (value: unknown): string | undefined => {
  const id = value && typeof value === 'object' ? (value as { sync_id?: unknown }).sync_id : undefined;
  if (id == null) return undefined;
  if (typeof id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    throw new BadRequestException('reconciliation_identity_invalid');
  }
  return id;
};
