import { DatasetManifestT } from '../../../../../../types';

const isCount = (value: unknown): value is number => typeof value === 'number' && value >= 0;
const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

/**
 * Checks that a parsed manifest.json has the shape the import relies on:
 * a version string, at least one file with a non-negative line count and,
 * when present, non-negative link counts and string license fields. Returns
 * null for anything else.
 */
export const parseManifest = (raw: unknown): DatasetManifestT | null => {
  const manifest = raw as DatasetManifestT | null | undefined;
  const lineCounts = manifest?.files && typeof manifest.files === 'object' ? Object.values(manifest.files) : [];
  const isValid =
    typeof manifest?.version === 'string' &&
    lineCounts.length > 0 &&
    lineCounts.every((f) => isCount(f?.lines)) &&
    (manifest.synonym_links === undefined || isCount(manifest.synonym_links)) &&
    (manifest.antonym_links === undefined || isCount(manifest.antonym_links)) &&
    isOptionalString(manifest.license) &&
    isOptionalString(manifest.attribution);
  return isValid ? manifest : null;
};
