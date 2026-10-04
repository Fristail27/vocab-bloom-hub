import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects, parquetSchema } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { OPENGLOSS_FILES, OPENGLOSS_VERSION } from '../../../../core/constants/opengloss';

export const COLUMNS = {
  senses: ['lexeme_id', 'sense_id', 'headword', 'pos', 'source', 'gloss', 'examples', 'relations'],
  lexicon: [
    'lexeme_id',
    'headword',
    'language',
    'kind',
    'source',
    'retired',
    'sense_ids',
    'morphology',
    'provenance_summary',
  ],
};
export type OpenGlossFilesT = { senses: string[]; lexicon: string[] };

/** CLI: an export directory with senses/ and lexicon/, or six explicit upload paths. */
export const openGlossFiles = async (
  input: string,
  options: Record<string, string>,
): Promise<OpenGlossFilesT> => {
  const directory = (await stat(input)).isDirectory();
  const files: OpenGlossFilesT = { senses: [], lexicon: [] };
  for (const file of OPENGLOSS_FILES) {
    const location = directory
      ? path.join(input, file.table, file.file_name)
      : file.field === 'file'
        ? input
        : options[file.field];
    if (!location) throw new Error(`Missing OpenGloss file: ${file.table}/${file.file_name}`);
    files[file.table].push(location);
  }
  return files;
};

const metadataOf = async (filename: string, columns: string[]) => {
  const file = await asyncBufferFromFile(filename);
  const metadata = await parquetMetadataAsync(file);
  const names = new Set(parquetSchema(metadata).children.map((field) => field.element.name));
  if (columns.some((column) => !names.has(column)))
    throw new Error('Not an OpenGloss table: missing required columns');
  return { file, metadata };
};

/** Check every shard before the installation can create or modify a dataset. */
export const validateOpenGlossFiles = async (input: string, options: Record<string, string>): Promise<void> => {
  const files = await openGlossFiles(input, options);
  for (const table of ['senses', 'lexicon'] as const) {
    for (const file of files[table]) await metadataOf(file, COLUMNS[table]);
  }
};

/** Neither filenames nor Parquet's Arrow schema encode a release. Recognize the verified bytes. */
export const openGlossVersion = async (
  input: string,
  options: Record<string, string>,
): Promise<string | null> => {
  const files = await openGlossFiles(input, options);
  for (const table of ['senses', 'lexicon'] as const) {
    const expected = OPENGLOSS_FILES.filter((file) => file.table === table);
    for (const [index, filename] of files[table].entries()) {
      if ((await stat(filename)).size !== expected[index].bytes) return null;
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(filename)) hash.update(chunk);
      if (hash.digest('hex') !== expected[index].sha256) return null;
    }
  }
  return OPENGLOSS_VERSION;
};

/** Project only useful columns, one row group at a time; never hold the release in memory. */
export async function* openGlossRows<T>(
  files: string[],
  columns: string[],
  progress?: (file: string, read: number) => void,
): AsyncGenerator<T> {
  for (const filename of files) {
    const { file, metadata } = await metadataOf(filename, columns);
    let rowStart = 0;
    for (const group of metadata.row_groups) {
      const rowEnd = rowStart + Number(group.num_rows);
      const rows = await parquetReadObjects({ file, metadata, columns, rowStart, rowEnd, compressors });
      for (const row of rows) yield row as T;
      rowStart = rowEnd;
      progress?.(filename, Math.floor((file.byteLength * rowEnd) / Number(metadata.num_rows)));
    }
  }
}
