import { DATASET_KNOWN_FILE_NAMES } from '../constants';
import { validOrigins } from '../../../../../core/utils/provenance';
import { DatasetManifestT, MANIFEST_PROVENANCE_FIELDS } from '../../../../../../types';

const isCount = (value: unknown): value is number => typeof value === 'number' && value >= 0;
const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

/**
 * Checks that a parsed manifest.json has the shape the import relies on:
 * a version string, at least one file with a non-negative line count and,
 * when present, non-negative link counts and string provenance fields. Returns
 * null for anything else.
 */
export const parseManifest = (raw: unknown): DatasetManifestT | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Physical names are derived here; never trust paths supplied by a manifest.
  let manifest = { ...(raw as DatasetManifestT), file_names: undefined } as DatasetManifestT;
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) return null;
  const envelope = manifest?.version as unknown;
  if (envelope && typeof envelope === 'object') {
    const version = envelope as { format?: unknown; dataset?: unknown };
    if (
      version.format !== 'provenance-v1' ||
      typeof version.dataset !== 'string' ||
      manifest?.provenance_format !== 1 ||
      !manifest.provenance
    )
      return null;
    const names = Object.keys(manifest.files ?? {});
    const prefixed = names.filter((name) => name.startsWith('provenance-v1.'));
    if (
      !names.length ||
      names.some((name) => !name.endsWith('.jsonl') || !DATASET_KNOWN_FILE_NAMES.includes(name)) ||
      (prefixed.length > 0 && prefixed.length !== names.length)
    )
      return null;
    // Read archives produced before the original filenames were restored too.
    const logicalName = (name: string) =>
      name.startsWith('provenance-v1.') ? name.slice('provenance-v1.'.length) : name;
    manifest = {
      ...manifest,
      version: version.dataset,
      files: Object.fromEntries(names.map((name) => [logicalName(name), manifest!.files[name]])),
      file_names: Object.fromEntries(names.map((name) => [logicalName(name), name])),
    };
  }
  if (manifest.provenance_format === 1 && !manifest.file_names) return null;
  const lineCounts = manifest?.files && typeof manifest.files === 'object' ? Object.values(manifest.files) : [];
  const isValid =
    typeof manifest?.version === 'string' &&
    (manifest.provenance_format === undefined || manifest.provenance_format === 1) &&
    (manifest.provenance === undefined ||
      (manifest.provenance_format === 1 &&
        validOrigins(manifest.provenance.origins) &&
        isOptionalString(manifest.provenance.attribution) &&
        isOptionalString(manifest.provenance.license_url) &&
        (manifest.provenance.attribution_url === null ||
          isOptionalString(manifest.provenance.attribution_url)) &&
        (manifest.provenance.title === null || typeof manifest.provenance.title === 'string') &&
        (manifest.provenance.notice === null || typeof manifest.provenance.notice === 'string') &&
        (manifest.provenance.description === null || typeof manifest.provenance.description === 'string') &&
        (manifest.provenance.license_text === null || typeof manifest.provenance.license_text === 'string'))) &&
    lineCounts.length > 0 &&
    lineCounts.every((f) => isCount(f?.lines)) &&
    (manifest.synonym_links === undefined || isCount(manifest.synonym_links)) &&
    (manifest.antonym_links === undefined || isCount(manifest.antonym_links)) &&
    (manifest.modified_entries === undefined || isCount(manifest.modified_entries)) &&
    MANIFEST_PROVENANCE_FIELDS.every((field) => isOptionalString(manifest[field]));
  if (!isValid) return null;
  if (manifest.provenance) {
    const snapshot = manifest.provenance;
    const limited = (value: unknown, max: number) =>
      value === null || (typeof value === 'string' && value.length <= max);
    if (
      !limited(snapshot.title, 120) ||
      !limited(snapshot.notice, 10000) ||
      !limited(snapshot.description, 10000) ||
      !limited(snapshot.license_text, 100000) ||
      (snapshot.attribution !== undefined &&
        (!snapshot.attribution.trim() || snapshot.attribution.length > 1000))
    )
      return null;
    for (const url of [snapshot.license_url, snapshot.attribution_url]) {
      if (url == null) continue;
      try {
        if (url.length > 2000 || !['http:', 'https:'].includes(new URL(url).protocol)) return null;
      } catch {
        return null;
      }
    }
    // Only portable terms may reach the registry. Never assign arbitrary
    // properties (schema, own, name, etc.) from an uploaded JSON object.
    manifest.provenance = {
      title: snapshot.title,
      notice: snapshot.notice,
      description: snapshot.description,
      license_text: snapshot.license_text,
      origins: snapshot.origins,
      ...(snapshot.attribution !== undefined && { attribution: snapshot.attribution }),
      ...(snapshot.attribution_url !== undefined && { attribution_url: snapshot.attribution_url }),
      ...(snapshot.license_url !== undefined && { license_url: snapshot.license_url }),
    };
  }
  return manifest;
};

/**
 * Mark the richer contract without renaming the dataset files. Local legacy
 * importers reject the envelope and the required marker. API versions stay strings.
 * Remote consumers must understand this contract to preserve source metadata.
 */
export const portableManifest = (manifest: DatasetManifestT): object => ({
  ...manifest,
  version: { format: 'provenance-v1', dataset: manifest.version },
});
