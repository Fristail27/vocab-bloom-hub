import { BadRequestException, Logger } from '@nestjs/common';
import { readdir, realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { ImportSourceFileT } from '../../../../../../types';
import { MANIFEST_FILE_NAME } from '../constants';
import { DatasetSource } from './types';
import { DirectoryDatasetSource } from './directorySource';
import { openZipDatasetSource } from './zipSource';

/**
 * The directory the server may read datasets from (`DICTIONARY_IMPORT_DIR`,
 * e.g. a mounted volume). Unset means server-side files are not offered at
 * all; the admin can still upload an archive.
 */
export const getImportDir = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const dir = env.DICTIONARY_IMPORT_DIR?.trim();
  return dir ? path.resolve(dir) : null;
};

/**
 * Resolves a dataset path relative to the import directory, refusing
 * anything that escapes it (`..`, absolute paths, symlinks pointing outside)
 */
export const resolveImportPath = async (relativePath: string, logger: Logger): Promise<string> => {
  const importDir = getImportDir();
  if (!importDir) {
    throw new BadRequestException(ErrorCodes.import_dir_not_configured);
  }
  const base = await realpath(importDir).catch(() => null);
  if (!base) {
    logger.warn(`DICTIONARY_IMPORT_DIR "${importDir}" does not exist`);
    throw new BadRequestException(ErrorCodes.import_dir_not_configured);
  }
  const reject = (): never => {
    logger.warn(`Dataset path "${relativePath}" is outside DICTIONARY_IMPORT_DIR or does not exist`);
    throw new BadRequestException(ErrorCodes.dataset_file_not_found);
  };
  // the lexical check runs before any file-system call: `..` and absolute
  // paths are refused here (the directory itself is not a dataset either)
  const candidate = path.resolve(base, relativePath);
  if (candidate === base || !candidate.startsWith(base + path.sep)) return reject();
  // the physical check catches symlinks that point outside the directory
  const target = await realpath(candidate).catch(() => null);
  if (!target || target === base || !target.startsWith(base + path.sep)) return reject();
  return target;
};

/** Opens a dataset directory or archive inside the import directory */
export const openImportDirSource = async (relativePath: string, logger: Logger): Promise<DatasetSource> => {
  const target = await resolveImportPath(relativePath, logger);
  const info = await stat(target);
  if (info.isDirectory()) return DirectoryDatasetSource.open(target, logger);
  if (info.isFile() && target.toLowerCase().endsWith('.zip')) return openZipDatasetSource(target, logger);
  logger.warn(`Dataset path "${relativePath}" is neither a directory nor a zip archive`);
  throw new BadRequestException(ErrorCodes.dataset_file_not_found);
};

/**
 * Lists what the import directory offers: zip archives and sub-directories
 * holding a manifest.json, one level deep. An unset or missing directory
 * yields an empty list.
 */
export const listImportDir = async (): Promise<ImportSourceFileT[]> => {
  const importDir = getImportDir();
  if (!importDir) return [];
  const entries = await readdir(importDir, { withFileTypes: true }).catch(() => []);
  const files: ImportSourceFileT[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      const info = await stat(path.join(importDir, entry.name)).catch(() => null);
      files.push({
        path: entry.name,
        kind: 'zip',
        size: info?.size ?? 0,
        modified_at: info?.mtime.toISOString(),
      });
    } else if (entry.isDirectory()) {
      const manifest = await stat(path.join(importDir, entry.name, MANIFEST_FILE_NAME)).catch(() => null);
      if (manifest?.isFile()) {
        files.push({ path: entry.name, kind: 'directory', size: 0, modified_at: manifest.mtime.toISOString() });
      }
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
};
