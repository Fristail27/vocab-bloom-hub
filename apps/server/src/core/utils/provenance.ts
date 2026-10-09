import { BadRequestException, ConflictException } from '@nestjs/common';
import { registerDecorator } from 'class-validator';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { findStandardLicense } from '../../../core/constants/data_licenses';
import { incompatibleShareAlike } from '../../../core/utils/provenance';
import type { OriginAcquisitionT, OriginT, OriginLicenseT } from '../../../types';

const string = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const url = (value: unknown): boolean => {
  if (!string(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const optional = (value: unknown, check: (value: unknown) => boolean): boolean =>
  value === undefined || check(value);
const timestamp = (value: unknown): boolean =>
  value === null || (string(value, 40) && Number.isFinite(Date.parse(value)));

/** Same license shape and custom-license text rule for word origins and recordings. */
export const validOriginLicense = (value: unknown): value is OriginLicenseT => {
  if (!value || typeof value !== 'object') return false;
  const license = value as OriginLicenseT;
  return (
    string(license.name, 200) &&
    url(license.url) &&
    optional(license.spdx, (id) => string(id, 100)) &&
    optional(license.text, (text) => string(text, 100_000)) &&
    (Boolean(license.spdx && findStandardLicense(license.spdx)) || string(license.text, 100_000))
  );
};

/** Also used before importing JSON; DTO validation alone cannot protect imports. */
export const validOrigins = (value: unknown): value is OriginT[] => {
  if (!Array.isArray(value) || value.length > 100 || JSON.stringify(value).length > 2_000_000) return false;
  const ids = new Set<string>();
  const acquisitions = new Set<string>();
  return value.every((origin: OriginT) => {
    if (!origin || !string(origin.id, 200) || ids.has(origin.id)) return false;
    ids.add(origin.id);
    return (
      string(origin.name, 200) &&
      (origin.version === null || string(origin.version, 200)) &&
      optional(origin.url, url) &&
      optional(origin.record_url, url) &&
      Array.isArray(origin.licenses) &&
      origin.licenses.length > 0 &&
      origin.licenses.length <= 30 &&
      origin.licenses.every(validOriginLicense) &&
      ['all', 'any'].includes(origin.license_relation) &&
      string(origin.attribution, 10_000) &&
      Array.isArray(origin.notices) &&
      origin.notices.length <= 50 &&
      origin.notices.every((notice) => string(notice, 100_000)) &&
      ['word', 'dataset'].includes(origin.scope) &&
      ['dataset', 'manual'].includes(origin.method) &&
      timestamp(origin.recorded_at) &&
      optional(
        origin.acquisitions,
        (events) =>
          Array.isArray(events) &&
          events.length <= 1000 &&
          events.every((event: OriginAcquisitionT) => {
            if (!event || !string(event.id, 200) || acquisitions.has(event.id)) return false;
            acquisitions.add(event.id);
            return (
              (origin.method === 'dataset' || event.via !== undefined) &&
              origin.inherited &&
              ['copy', 'fork'].includes(event.method) &&
              timestamp(event.recorded_at) &&
              optional(event.revision, (revision) => string(revision, 200)) &&
              (event.via === undefined ||
                (event.via !== null &&
                  string(event.via.name, 200) &&
                  (event.via.version === null || string(event.via.version, 200)) &&
                  optional(event.via.url, url)))
            );
          }),
      ) &&
      typeof origin.inherited === 'boolean'
    );
  });
};

export const IsOrigins = (): PropertyDecorator => (target, property) => {
  registerDecorator({
    name: 'isOrigins',
    target: target.constructor,
    propertyName: String(property),
    validator: { validate: validOrigins, defaultMessage: () => ErrorCodes.provenance_invalid },
  });
};

export function assertOrigins(value: unknown): asserts value is OriginT[] {
  if (!validOrigins(value)) throw new BadRequestException(ErrorCodes.provenance_invalid);
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

export const assertOriginsEdit = (before: OriginT[], after: OriginT[]): void => {
  assertOrigins(after);
  for (const inherited of before.filter((origin) => origin.inherited)) {
    const next = after.find((origin) => origin.id === inherited.id);
    if (canonical(next) !== canonical(inherited)) throw new ConflictException(ErrorCodes.provenance_inherited);
  }
  for (const origin of after) {
    if (before.some((old) => old.id === origin.id && old.inherited)) continue;
    if (origin.inherited || origin.method !== 'manual' || origin.acquisitions?.length)
      throw new BadRequestException(ErrorCodes.provenance_invalid);
  }
};

export const assertCompatibleOrigins = (origins: OriginT[], license: string): void => {
  if (incompatibleShareAlike(origins, license))
    throw new ConflictException(ErrorCodes.provenance_license_conflict);
};
