import { isEmptyValue } from './isEmptyValue';
import { SYSTEM_FIELDS } from '../constants';

export function cleanEntity(input: any): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => cleanEntity(item)).filter((item) => !isEmptyValue(item));
  }

  if (input instanceof Date) {
    return input;
  }

  if (input !== null && typeof input === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (SYSTEM_FIELDS.includes(key)) continue;

      result[key] = cleanEntity(value);
    }

    return result;
  }
  return input;
}
