import { BadRequestException, Logger } from '@nestjs/common';
import * as yauzl from 'yauzl';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { DatasetManifestT } from '../../../../../../types';
import { DATASET_KNOWN_FILE_NAMES, MAX_DATASET_FILE_BYTES } from '../constants';
import { DirectoryDatasetSource } from './directorySource';
import { getImportTmpDir } from './huggingFaceSource';

const openZip = (zipPath: string): Promise<yauzl.ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => (err ? reject(err) : resolve(zip)));
  });

const openEntryStream = (zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream)));
  });

// Entries operating systems add to archives ("__MACOSX/...", ".DS_Store")
const isJunkEntry = (name: string): boolean =>
  name.startsWith('__MACOSX/') || path.basename(name) === '.DS_Store' || path.basename(name).startsWith('._');

/**
 * Extracts the dataset files of an archive into a fresh temporary directory.
 * Accepts the flat layout the export produces and the same files inside one
 * wrapper folder (an archive made from an exported directory). Unknown
 * files, path traversal and oversized entries reject the archive.
 */
export const extractDatasetZip = async (zipPath: string, logger: Logger): Promise<string> => {
  const reject = (reason: string): never => {
    logger.warn(`Dataset archive "${zipPath}" rejected: ${reason}`);
    throw new BadRequestException(ErrorCodes.dataset_invalid);
  };

  const zip = await openZip(zipPath).catch(() => reject('not a zip archive'));
  const outDir = path.join(getImportTmpDir(), `dataset-${randomUUID()}`);
  await mkdir(outDir, { recursive: true });

  try {
    await new Promise<void>((resolve, rejectExtraction) => {
      // the wrapper folder is decided by the first regular entry; every
      // following entry must sit in the same folder (or at the root)
      let prefix: string | null = null;

      zip.on('error', rejectExtraction);
      zip.on('end', resolve);
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          const name = entry.fileName;
          if (name.endsWith('/') || isJunkEntry(name)) {
            zip.readEntry();
            return;
          }
          if (name.includes('..') || path.isAbsolute(name) || name.includes('\\'))
            reject(`unsafe entry "${name}"`);

          const dirName = path.posix.dirname(name);
          const entryPrefix = dirName === '.' ? '' : `${dirName}/`;
          prefix ??= entryPrefix;
          if (entryPrefix !== prefix || entryPrefix.split('/').length > 2) reject(`unexpected entry "${name}"`);

          const baseName = path.posix.basename(name);
          if (!DATASET_KNOWN_FILE_NAMES.includes(baseName)) reject(`unknown file "${name}"`);
          if (entry.uncompressedSize > MAX_DATASET_FILE_BYTES) reject(`"${name}" is too large`);

          const stream = await openEntryStream(zip, entry);
          await pipeline(stream, createWriteStream(path.join(outDir, baseName)));
          zip.readEntry();
        })().catch(rejectExtraction);
      });
      zip.readEntry();
    });
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    if (error instanceof BadRequestException) throw error;
    return reject(error instanceof Error ? error.message : String(error));
  } finally {
    zip.close();
  }

  return outDir;
};

/** Opens a dataset archive as a source; the extracted copy is removed on dispose */
export const openZipDatasetSource = async (
  zipPath: string,
  logger: Logger,
  // manifest values given explicitly; they win over the archive's manifest.json
  manifestOverrides: Partial<DatasetManifestT> = {},
): Promise<DirectoryDatasetSource> => {
  const dir = await extractDatasetZip(zipPath, logger);
  try {
    return await DirectoryDatasetSource.open(dir, logger, true, manifestOverrides);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
};
