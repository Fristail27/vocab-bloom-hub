import fs from 'node:fs';
import path from 'node:path';

export const REPO_URL = 'https://github.com/Fristail27/vocab-bloom-hub';
export const REPO_BLOB_URL = `${REPO_URL}/blob/main`;
export const REPO_RAW_URL = 'https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main';
export const DATASET_URL = 'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en';

/**
 * The repository root: the site renders the README, docs/*.md, the licences
 * and the OpenAPI document from it at build time (the pages are static).
 * CONTENT_ROOT overrides it for a build outside the checkout layout
 */
export const repoRoot = (): string => process.env.CONTENT_ROOT ?? path.resolve(process.cwd(), '../..');

// the pages that read the repository are static: the files are read at build
// time only, so the tracer must not pull the whole checkout into the output
export const readRepoFile = (file: string): string =>
  fs.readFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ repoRoot(), file), 'utf8');
