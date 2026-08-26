import { BadRequestException, Logger } from '@nestjs/common';
import { copyFile, mkdir, rename, rm, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { DatasetManifestT } from '../../../../../../types';
import { UPLOAD_ARCHIVE_FIELD, UPLOAD_FILE_FIELDS, UploadFileFieldT } from '../constants';
import { DatasetSource } from './types';
import { DirectoryDatasetSource } from './directorySource';
import { getImportTmpDir } from './huggingFaceSource';
import { openZipDatasetSource } from './zipSource';

export type UploadedFileT = { path: string; originalname: string };
/** What multer collected, keyed by multipart field */
export type UploadedFilesByFieldT = Partial<
  Record<UploadFileFieldT | typeof UPLOAD_ARCHIVE_FIELD, UploadedFileT[]>
>;
/** Manifest values typed by hand instead of (or on top of) an uploaded manifest.json */
export type ManualManifestT = Partial<Pick<DatasetManifestT, 'version' | 'synonym_links' | 'antonym_links'>>;

const allFiles = (files: UploadedFilesByFieldT): UploadedFileT[] => Object.values(files).flat();

/**
 * Opens what the admin uploaded as a dataset source: either one archive in
 * the `archive` field, or the dataset files in their own fields (any subset
 * of the jsonl slots, manifest.json optional). The uploads are moved into a
 * directory of their own that is removed with the source; a rejected upload
 * is deleted right away.
 */
export const openUploadedDatasetSource = async (
  files: UploadedFilesByFieldT,
  manual: ManualManifestT,
  logger: Logger,
): Promise<DatasetSource> => {
  const reject = async (reason: string): Promise<never> => {
    logger.warn(`Uploaded dataset rejected: ${reason}`);
    await Promise.allSettled(allFiles(files).map((f) => unlink(f.path)));
    throw new BadRequestException(ErrorCodes.dataset_invalid);
  };

  if (allFiles(files).length === 0) {
    throw new BadRequestException(ErrorCodes.dataset_upload_missing);
  }
  for (const [field, list] of Object.entries(files)) {
    if ((list?.length ?? 0) > 1) return reject(`field "${field}" carries more than one file`);
  }

  const archive = files[UPLOAD_ARCHIVE_FIELD]?.[0];
  if (archive) {
    if (allFiles(files).length > 1) return reject('an archive must be uploaded on its own');
    try {
      return await openZipDatasetSource(archive.path, logger, manual);
    } finally {
      await unlink(archive.path).catch(() => {});
    }
  }

  const dir = path.join(getImportTmpDir(), `upload-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    for (const [field, targetName] of Object.entries(UPLOAD_FILE_FIELDS) as [UploadFileFieldT, string][]) {
      const file = files[field]?.[0];
      if (!file) continue;
      const target = path.join(dir, targetName);
      // multer's dest storage may sit on another device: rename first, copy as a fallback
      await rename(file.path, target).catch(async () => {
        await copyFile(file.path, target);
        await unlink(file.path).catch(() => {});
      });
    }
    return await DirectoryDatasetSource.open(dir, logger, true, manual);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    await Promise.allSettled(allFiles(files).map((f) => unlink(f.path)));
    throw error;
  }
};
