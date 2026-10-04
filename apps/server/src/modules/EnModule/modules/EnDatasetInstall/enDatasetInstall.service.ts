import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import type { Response } from 'express';
import {
  DatasetCatalogEntryT,
  DatasetCatalogFileT,
  findCatalogEntry,
  MAX_SOURCE_UPLOAD_BYTES,
} from '../../../../../core/constants/dataset_catalog';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { DownloadDatasetReqT, ImportTriggerE } from '../../../../../types';
import { convert, versionOfConversion } from '../../../../converters/convert';
import { findSource } from '../../../../converters/sources';
import { validateOpenGlossFiles } from '../../../../converters/sources/opengloss/files';
import { firstLineOf, packingOf, unpackFiles, WORDNET_FILES } from '../../../../converters/unpack';
import { DatasetsService } from '../../../DatasetsModule/datasets.service';
import { EnDictionaryImportPhasesE } from '../EnImportDictionary/constants';
import { EnImportDictionaryService } from '../EnImportDictionary/enImportDictionary.service';
import { ImportStatusService } from '../EnImportDictionary/importStatus.service';
import { HttpImportProgressSink, ImportProgressSink } from '../EnImportDictionary/progress';
import { DatasetSource, DirectoryDatasetSource, getImportTmpDir } from '../EnImportDictionary/sources';
import { downloadFile } from '../EnImportDictionary/sources/downloadFile';

export type SourceUploadT = { path: string; originalname: string };
export type SourceUploadsT = Partial<Record<DatasetCatalogFileT['field'], SourceUploadT | undefined>>;

// Source files exceed a gigabyte: a progress chunk per percent is plenty.
const PROGRESS_STEP_PERCENT = 1;
type ConvertibleDatasetT = DatasetCatalogEntryT & {
  install: Extract<DatasetCatalogEntryT['install'], { kind: 'convert' }>;
};

/**
 * Installs a dataset of the catalog from the file its source distributes
 * (issue #527): the files are downloaded on the server or attached by the admin. The server
 * converts it into the project's format and imports the result into the
 * dataset's own schema — while the active dataset keeps serving. A dataset
 * that is installed already is updated: its entries are replaced with the
 * ones of the newer file, the ones the admin edited are kept.
 */
@Injectable()
export class EnDatasetInstallService {
  private readonly logger = new Logger(EnDatasetInstallService.name);

  constructor(
    private readonly importService: EnImportDictionaryService,
    private readonly datasets: DatasetsService,
    private readonly importStatus: ImportStatusService,
  ) {}

  async install(name: string, uploads: SourceUploadsT, res: Response): Promise<void> {
    const work: string[] = [];
    try {
      const entry = await this.entryOf(name);
      const requiredFiles = entry.install.files;
      if (!uploads.file) throw new BadRequestException(ErrorCodes.dataset_upload_missing);
      if (requiredFiles.some((file) => file.required && !uploads[file.field])) {
        throw new BadRequestException(ErrorCodes.dataset_upload_missing);
      }
      if (
        Object.entries(uploads).some(
          ([field, upload]) => upload && !requiredFiles.some((file) => file.field === field),
        )
      ) {
        throw new BadRequestException(ErrorCodes.dataset_source_invalid);
      }
      const { input, version, sourceOptions } = await this.prepare(entry, uploads, work);

      const installed = (await this.datasets.list()).datasets.find((dataset) => dataset.name === name);
      await this.importService.importFrom(
        (progress) => this.convert(entry, input, version, sourceOptions, progress),
        `${entry.title}, "${uploads.file.originalname}"`,
        new HttpImportProgressSink(res),
        ImportTriggerE.manual,
        { dataset: name, update: Boolean(installed?.imported_at) },
      );
    } finally {
      await Promise.allSettled([
        ...Object.values(uploads).map((upload) => (upload ? unlink(upload.path) : undefined)),
        ...work.map((dir) => rm(dir, { recursive: true, force: true })),
      ]);
    }
  }

  /** The import slot includes downloading, validation and conversion, not just database writes. */
  async download(name: string, body: DownloadDatasetReqT, res: Response): Promise<void> {
    const entry = await this.entryOf(name);
    if (body.pronunciations && !entry.install.files.some((file) => file.field === 'pronunciations')) {
      throw new BadRequestException(ErrorCodes.dataset_source_invalid);
    }
    const selected = entry.install.files.filter(
      (file) => file.required || (body.pronunciations && file.field === 'pronunciations'),
    );
    const installed = (await this.datasets.list()).datasets.find((dataset) => dataset.name === name);
    await this.importService.importFrom(
      async (progress) => {
        const dir = await mkdtemp(path.join(getImportTmpDir(), 'source-download-'));
        const work = [dir];
        const uploads: SourceUploadsT = {};
        try {
          for (const [index, file] of selected.entries()) {
            // Different tables may distribute files with exactly the same name.
            const destination = path.join(dir, file.field);
            progress.write({
              percent: (index / selected.length) * 100,
              stage: EnDictionaryImportPhasesE.downloading_database,
            });
            await downloadFile(
              file.url,
              destination,
              this.logger,
              {
                start: () => {},
                end: () => {},
                write: (chunk) =>
                  progress.write({
                    percent: ((index + chunk.percent / 100) / selected.length) * 100,
                    stage: EnDictionaryImportPhasesE.downloading_database,
                  }),
              },
              { maxBytes: MAX_SOURCE_UPLOAD_BYTES },
            );
            uploads[file.field] = { path: destination, originalname: file.file_name };
          }
          const { input, version, sourceOptions } = await this.prepare(entry, uploads, work);
          return await this.convert(entry, input, version, sourceOptions, progress);
        } finally {
          await Promise.allSettled(work.map((folder) => rm(folder, { recursive: true, force: true })));
        }
      },
      `${entry.title}, download from source`,
      new HttpImportProgressSink(res),
      ImportTriggerE.manual,
      { dataset: name, update: Boolean(installed?.imported_at) },
    );
  }

  private async entryOf(name: string): Promise<ConvertibleDatasetT> {
    const entry = findCatalogEntry(name);
    if (!entry) throw new NotFoundException(ErrorCodes.dataset_not_found);
    if (entry.install.kind !== 'convert') throw new BadRequestException(ErrorCodes.dataset_not_installable);
    if (!this.datasets.supported) throw new ConflictException(ErrorCodes.datasets_not_supported);
    if (this.importStatus.running) throw new ConflictException(ErrorCodes.import_in_progress);
    if ((await this.datasets.installed()).some((dataset) => dataset.name === name && dataset.own)) {
      throw new ConflictException(ErrorCodes.dataset_already_exists);
    }
    return entry as ConvertibleDatasetT;
  }

  /** Both installation modes validate and version the same source files. */
  private async prepare(entry: ConvertibleDatasetT, uploads: SourceUploadsT, work: string[]) {
    if (!uploads.file) throw new BadRequestException(ErrorCodes.dataset_upload_missing);
    const sourceOptions = {
      ...entry.install.options,
      ...Object.fromEntries(
        Object.entries(uploads)
          .filter(([, upload]) => upload)
          .map(([field, upload]) => [field === 'pronunciations' ? 'cmudict' : field, upload!.path]),
      ),
    };
    const input = await this.inputOf(entry, uploads.file, work, sourceOptions);
    if (uploads.pronunciations) await this.assertPronunciations(uploads.pronunciations);
    const version = await this.versionOf(entry, uploads.file, sourceOptions);

    return { input, version, sourceOptions };
  }

  private reject(entry: DatasetCatalogEntryT, upload: SourceUploadT, reason: string): never {
    this.logger.warn(`"${upload.originalname}" rejected as the source of "${entry.name}": ${reason}`);
    throw new BadRequestException(ErrorCodes.dataset_source_invalid);
  }

  /**
   * What the adapter reads, checked to be what the source distributes before
   * anything is converted: a wrong file is refused as a plain HTTP error.
   * A packed release is unpacked here, into a folder `work` remembers.
   */
  private async inputOf(
    entry: DatasetCatalogEntryT,
    upload: SourceUploadT,
    work: string[],
    options: Record<string, string>,
  ): Promise<string> {
    if (entry.install.kind !== 'convert') throw new BadRequestException(ErrorCodes.dataset_not_installable);
    if (entry.install.adapter === 'opengloss') {
      await validateOpenGlossFiles(upload.path, options).catch((error: unknown) =>
        this.reject(entry, upload, String(error)),
      );
      return upload.path;
    }
    if (entry.install.adapter === 'wordnet') {
      const dir = path.join(getImportTmpDir(), `source-${randomUUID()}`);
      work.push(dir);
      const found = await unpackFiles(upload.path, dir, WORDNET_FILES).catch((error: unknown) =>
        this.reject(entry, upload, error instanceof Error ? error.message : String(error)),
      );
      if (!found.includes('data.noun') || !found.includes('index.noun')) {
        this.reject(entry, upload, 'no data.noun and index.noun in the archive');
      }
      return dir;
    }
    if ((await packingOf(upload.path)) === 'zip') this.reject(entry, upload, 'a zip archive, not the extract');
    const line = await firstLineOf(upload.path).catch(() => '');
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      this.reject(entry, upload, 'the first line is not JSON');
    }
    const { word, pos } = (record ?? {}) as { word?: unknown; pos?: unknown };
    if (typeof word !== 'string' || typeof pos !== 'string') {
      this.reject(entry, upload, 'the first line is not an entry of the extract');
    }
    return upload.path;
  }

  /** `word PHONE PHONE …` with the stress on the vowels, comments behind `;;;` or `#` */
  private async assertPronunciations(upload: SourceUploadT): Promise<void> {
    const plain = (await packingOf(upload.path)) === 'plain';
    const line = plain ? await firstLineOf(upload.path, 64 * 1024).catch(() => '') : '';
    if (!/^(;;;|#)|^\S+\s+[A-Z]+[0-2]?(\s+[A-Z]+[0-2]?)*\s*(#.*)?$/.test(line)) {
      this.logger.warn(`"${upload.originalname}" rejected: not a CMUdict file`);
      throw new BadRequestException(ErrorCodes.dataset_source_invalid);
    }
  }

  /**
   * The version the dataset is installed with (issue #530): what the
   * uploaded file says of itself — the day the extract was made, the edition
   * of the release — read before the file is unpacked or converted. A file
   * that does not say is recorded by the day of the installation.
   */
  private async versionOf(
    entry: DatasetCatalogEntryT,
    upload: SourceUploadT,
    sourceOptions: Record<string, string>,
  ): Promise<string> {
    if (entry.install.kind !== 'convert') throw new BadRequestException(ErrorCodes.dataset_not_installable);
    const adapter = findSource(entry.install.adapter);
    if (!adapter) throw new Error(`No converter "${entry.install.adapter}" for the dataset "${entry.name}"`);
    const version = await versionOfConversion({
      source: adapter,
      input: upload.path,
      sourceOptions,
    });
    this.logger.log(`${entry.title}, "${upload.originalname}": version ${version}`);
    return version;
  }

  /** Converts the source into a dataset in a folder of its own, removed when the import lets go of it */
  private async convert(
    entry: DatasetCatalogEntryT,
    input: string,
    version: string,
    sourceOptions: Record<string, string>,
    progress: ImportProgressSink,
  ): Promise<DatasetSource> {
    if (entry.install.kind !== 'convert') throw new BadRequestException(ErrorCodes.dataset_not_installable);
    const adapter = findSource(entry.install.adapter);
    if (!adapter) throw new Error(`No converter "${entry.install.adapter}" for the dataset "${entry.name}"`);

    const outDir = path.join(getImportTmpDir(), `converted-${randomUUID()}`);
    const startedAt = Date.now();
    let reported = -PROGRESS_STEP_PERCENT;
    progress.write({ percent: 0, stage: EnDictionaryImportPhasesE.converting_source });
    try {
      const summary = await convert({
        source: adapter,
        input,
        outDir,
        // of the uploaded file: what is converted may be a folder it was unpacked into
        version,
        sourceOptions,
        log: (message) => this.logger.log(`${entry.title}: ${message}`),
        onProgress: (read, total) => {
          const percent = total > 0 ? Math.min(100, (read / total) * 100) : 0;
          if (percent < reported + PROGRESS_STEP_PERCENT) return;
          reported = percent;
          progress.write({
            percent,
            stage: EnDictionaryImportPhasesE.converting_source,
            downloaded: read,
            total,
          });
        },
      });
      if (summary.entries === 0) throw new BadRequestException(ErrorCodes.dataset_source_invalid);
      this.logger.log(
        `${entry.title} converted in ${Date.now() - startedAt}ms: ${summary.entries} entries, ` +
          `${summary.meanings} meanings; skipped ${JSON.stringify(summary.skipped)}`,
      );
      progress.write({ percent: 100, stage: EnDictionaryImportPhasesE.converting_source });
      return await DirectoryDatasetSource.open(outDir, this.logger, true);
    } catch (error) {
      await rm(outDir, { recursive: true, force: true });
      throw error;
    }
  }
}
