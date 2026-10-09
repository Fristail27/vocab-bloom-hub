import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export const freeDictionaryQuery = (req: Request): URLSearchParams =>
  new URLSearchParams((req.originalUrl ?? req.url).split('?').slice(1).join('?'));
export function freeDictionaryBoolean(query: URLSearchParams, name: string): boolean {
  const value = query.get(name); // The first occurrence wins, as in upstream Poem.
  if (value === null || value === 'false') return false;
  if (value === 'true') return true;
  throw new BadRequestException(
    `failed to parse parameter \`${name}\`: failed to parse "boolean": provided string was not \`true\` or \`false\` (occurred while parsing "optional_boolean")`,
  );
}
export function validateFreeDictionaryQuery(
  req: Request,
  entries: boolean,
): { pretty: boolean; translations: boolean } {
  const query = freeDictionaryQuery(req);
  // Unknown upstream options are ignored, but never imply selection of a different dataset here.
  if (query.has('dataset'))
    throw new BadRequestException('Dataset selection is not supported; the active dataset is served.');
  const translations = entries ? freeDictionaryBoolean(query, 'translations') : false;
  return { translations, pretty: freeDictionaryBoolean(query, 'pretty') };
}
