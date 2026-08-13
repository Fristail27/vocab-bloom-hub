import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, In, MoreThan, Not, Repository } from 'typeorm';
import * as yazl from 'yazl';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { stat, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Readable } from 'node:stream';
import * as readline from 'node:readline';
import { type Response } from 'express';
import { EnWord } from '../../entities/en_word.entity';
import { ImportDictionaryReq } from './dto/ImportDictionaryReq.dto';
import { EnPartOfSpeechE, EnWordFormsE, ImportDictionaryChunkT } from '../../../../../types';
import { EnService } from '../../en.service';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { EnDictionaryImportPhasesE } from './constants';
import {
  cleanEntity,
  mapGrammarPatternFromSetToDB,
  mapWordFromSetToDB,
  prepareGrammarPatternForDataSet,
  preparePhraseForDataSet,
  prepareWordForDataSet,
} from './utils';
import {
  DataSetGrammarPatternT,
  DataSetPhraseT,
  DataSetWordT,
} from '../../../../../types/dictionaries/en/EnDataSetTypes';
import { mapPhraseFromSetToDB } from './utils/mapPhraseFromSetToDB';
import { PendingExport } from './types';

const DATASET_BASE_URL = 'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en/resolve/main/data';
const EXPORT_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class EnImportDictionaryService {
  private readonly logger = new Logger(EnImportDictionaryService.name);

  private readonly pendingExports = new Map<string, PendingExport>();

  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    private readonly enService: EnService,
  ) {}

  private async streamJsonlImport<T>(
    res: Response,
    fileName: string,
    stage: EnDictionaryImportPhasesE,
    allLength: number,
    plusCount: () => number,
    handleLine: (line: T) => Promise<void>,
  ): Promise<void> {
    const filePath = await this.downloadFile(fileName, res, EnDictionaryImportPhasesE.downloading_database);

    const startedAt = Date.now();
    this.logger.log(`Import stage "${stage}" started (file "${fileName}")`);

    try {
      const rl = readline.createInterface({
        input: createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      let lineNo = 0;
      for await (const l of rl) {
        lineNo++;
        if (!l.trim()) continue;
        const count = plusCount();

        try {
          const line: T = JSON.parse(l);
          await handleLine(line);
        } catch (error) {
          const isDuplicate = error instanceof Error && error.message === ErrorCodes.word_already_exists;
          if (!isDuplicate) {
            this.logger.error(
              `Import of "${fileName}" failed at line ${lineNo}`,
              error instanceof Error ? error.stack : String(error),
            );
            if (error instanceof HttpException) {
              throw error;
            }
            throw new InternalServerErrorException(ErrorCodes.internal_server_error);
          }
        }

        await this.reportImportProgress(res, count, allLength, stage);
      }

      this.logger.log(
        `Import stage "${stage}" finished: ${lineNo} lines from "${fileName}" in ${Date.now() - startedAt}ms`,
      );
    } finally {
      await unlink(filePath).catch(() => {});
    }
  }

  private async downloadFile(
    fileName: string,
    res: Response,
    stage: EnDictionaryImportPhasesE,
  ): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), 'vocab-bloom-import');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, fileName);

    this.logger.log(`Downloading dataset file "${fileName}"`);

    const response = await fetch(`${DATASET_BASE_URL}/${fileName}`).catch((error: Error) => {
      this.logger.error(`Failed to download dataset file "${fileName}"`, error.stack);
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    });
    if (!response.ok || !response.body) {
      this.logger.error(`Failed to download dataset file "${fileName}": HTTP ${response.status}`);
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    const bytesTotal = Number(response.headers.get('content-length')) || 0;
    let bytesDownloaded = 0;
    let lastReportedPercent = -1;

    const nodeStream = Readable.fromWeb(response.body as any);

    nodeStream.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length;

      if (bytesTotal > 0) {
        const percent = Math.floor((bytesDownloaded / bytesTotal) * 100);
        if (percent === lastReportedPercent) return;
        lastReportedPercent = percent;
      }

      const progressChunk: ImportDictionaryChunkT = {
        percent: bytesTotal > 0 ? Math.floor((bytesDownloaded / bytesTotal) * 100) : 0,
        stage,
        downloaded: bytesDownloaded,
        total: bytesTotal,
      };
      res.write(JSON.stringify(progressChunk) + '\n');
    });

    await pipeline(nodeStream, createWriteStream(filePath));

    const finalChunk: ImportDictionaryChunkT = {
      percent: 100,
      stage,
      downloaded: bytesDownloaded,
      total: bytesTotal || bytesDownloaded,
    };
    res.write(JSON.stringify(finalChunk) + '\n');

    return filePath;
  }

  private async reportImportProgress(
    res: Response,
    count: number,
    allLength: number,
    stage: EnDictionaryImportPhasesE,
  ): Promise<void> {
    if (count % 50 !== 0) return;
    const chunk: ImportDictionaryChunkT = {
      percent: Math.min(100, (count / allLength) * 100),
      stage,
    };
    res.write(JSON.stringify(chunk) + '\n');
    await new Promise((r) => setTimeout(r, 1));
  }

  private async saveWords(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      res,
      'vocab-bloom-hub-en-words.jsonl',
      EnDictionaryImportPhasesE.saving_words,
      allLength,
      plusCount,
      async (line) => {
        await this.enService.addWord(mapWordFromSetToDB(line));
      },
    );
  }

  private async saveGrammarPatterns(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetGrammarPatternT>(
      res,
      'vocab-bloom-hub-en-grammar-patterns.jsonl',
      EnDictionaryImportPhasesE.saving_grammar_patterns,
      allLength,
      plusCount,
      async (line) => {
        await this.enService.addWord(mapGrammarPatternFromSetToDB(line));
      },
    );
  }

  private async savePhrases(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetPhraseT>(
      res,
      'vocab-bloom-hub-en-phrases.jsonl',
      EnDictionaryImportPhasesE.saving_phrases,
      allLength,
      plusCount,
      async (line) => {
        await this.enService.addWord(mapPhraseFromSetToDB(line));
      },
    );
  }

  private async savePhrasalVerbs(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      res,
      'vocab-bloom-hub-en-phrasal-verbs.jsonl',
      EnDictionaryImportPhasesE.saving_phrasal_verbs,
      allLength,
      plusCount,
      async ({ word, phrasal_variants }) => {
        const wordEntity = await this.enService.getWordRow(word, EnPartOfSpeechE.verb, EnWordFormsE.base_form);
        if (!wordEntity) {
          this.logger.warn(`Phrasal base verb "${word}" is missing in the dataset, skipping its variants`);
          return;
        }

        for (const w of phrasal_variants) {
          const variantEntity = await this.enService.getWordRow(
            w,
            EnPartOfSpeechE.verb,
            EnWordFormsE.base_form,
          );
          if (!variantEntity) {
            this.logger.warn(`Phrasal variant "${w}" of "${word}" is missing in the dataset, skipping`);
            continue;
          }

          variantEntity.base_phrasal = wordEntity;
          await this.enWordsRep.save(variantEntity);
        }
      },
    );
  }

  async importDictionary(body: ImportDictionaryReq, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const startedAt = Date.now();
    this.logger.log('Dictionary import started');

    let count = 0;
    const plusCount = () => count++;
    const allLength = 87074 + 912 + 28560 + 28;
    await this.reportImportProgress(res, count, allLength, EnDictionaryImportPhasesE.downloading_database);

    await this.saveWords(res, allLength, plusCount);
    await this.savePhrasalVerbs(res, allLength, plusCount);
    await this.saveGrammarPatterns(res, allLength, plusCount);
    await this.savePhrases(res, allLength, plusCount);

    const finalChunk: ImportDictionaryChunkT = {
      percent: 100,
      stage: EnDictionaryImportPhasesE.completed,
    };
    res.write(JSON.stringify(finalChunk) + '\n');

    res.end();

    this.logger.log(`Dictionary import completed: ${count} records in ${Date.now() - startedAt}ms`);
  }

  private getExportTmpDir(): string {
    const dir = path.join(os.tmpdir(), 'vocab-bloom-export');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private async exportEntities<T>(
    outPath: string,
    total: number,
    processedSoFar: () => number,
    addProcessed: (n: number) => void,
    stage: EnDictionaryImportPhasesE,
    whereExtra: FindOptionsWhere<EnWord>,
    relations: FindOptionsRelations<EnWord>,
    prepare: (word: EnWord) => T,
    onProgress: (percent: number, stage: EnDictionaryImportPhasesE) => void,
  ): Promise<void> {
    const outStream = createWriteStream(outPath, { encoding: 'utf-8' });
    const batchSize = 200;
    let lastId = 0;

    try {
      while (true) {
        const batch = await this.enWordsRep.find({
          where: {
            id: MoreThan(lastId),
            form_of_word: EnWordFormsE.base_form,
            ...whereExtra,
          },
          order: { id: 'ASC' },
          take: batchSize,
          relations,
        });

        if (batch.length === 0) break;

        for (const word of batch) {
          const prepared = prepare(word);
          const cleaned = cleanEntity(prepared);
          outStream.write(JSON.stringify(cleaned) + '\n');
        }

        lastId = batch[batch.length - 1].id;
        addProcessed(batch.length);

        onProgress(total > 0 ? Math.min(100, (processedSoFar() / total) * 100) : 100, stage);
        await new Promise((r) => setTimeout(r, 1));
      }
    } catch (error) {
      this.logger.error(`Export stage "${stage}" failed`, error instanceof Error ? error.stack : String(error));
      outStream.close();
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    await new Promise<void>((resolve, reject) => {
      outStream.end((err?: Error) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Собирает 3 jsonl-файла во временной папке, упаковывает их в zip,
   * регистрирует архив под exportId и возвращает этот id.
   * Сам процесс идёт через res-стрим (NDJSON прогресс), а скачивание —
   * отдельным GET-запросом на /export/download/:exportId.
   */
  async exportDictionary(res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const exportId = randomUUID();
    const tmpDir = this.getExportTmpDir();
    const runDir = path.join(tmpDir, exportId);
    mkdirSync(runDir, { recursive: true });

    const wordsPath = path.join(runDir, 'vocab-bloom-hub-en-words.jsonl');
    const phrasesPath = path.join(runDir, 'vocab-bloom-hub-en-phrases.jsonl');
    const grammarPath = path.join(runDir, 'vocab-bloom-hub-en-grammar-patterns.jsonl');
    const zipPath = path.join(tmpDir, `${exportId}.zip`);

    const startedAt = Date.now();
    const total = await this.enWordsRep.count({ where: { form_of_word: EnWordFormsE.base_form } });
    this.logger.log(`Dictionary export ${exportId} started: ${total} base records to export`);

    let processed = 0;
    const addProcessed = (n: number) => (processed += n);
    const emit = (percent: number, stage: EnDictionaryImportPhasesE) => {
      const chunk: ImportDictionaryChunkT = { percent, stage };
      res.write(JSON.stringify(chunk) + '\n');
    };

    try {
      await this.exportEntities(
        wordsPath,
        total,
        () => processed,
        addProcessed,
        EnDictionaryImportPhasesE.saving_words,
        { part_of_speech: Not(In([EnPartOfSpeechE.phrase, EnPartOfSpeechE.grammar_pattern])) },
        {
          base_phrasal: { word: true },
          phrasal_variants: { word: true },
          word: true,
          forms: { word: true },
          short_translations: true,
          meanings: { translations: true },
        },
        prepareWordForDataSet,
        emit,
      );

      await this.exportEntities(
        phrasesPath,
        total,
        () => processed,
        addProcessed,
        EnDictionaryImportPhasesE.saving_phrases,
        { part_of_speech: EnPartOfSpeechE.phrase },
        { word: true, short_translations: true, meanings: { translations: true } },
        preparePhraseForDataSet,
        emit,
      );

      await this.exportEntities(
        grammarPath,
        total,
        () => processed,
        addProcessed,
        EnDictionaryImportPhasesE.saving_grammar_patterns,
        { part_of_speech: EnPartOfSpeechE.grammar_pattern },
        { word: true, short_translations: true, meanings: { translations: true } },
        prepareGrammarPatternForDataSet,
        emit,
      );

      emit(100, EnDictionaryImportPhasesE.packing_archive);
      await this.zipFiles(zipPath, [wordsPath, phrasesPath, grammarPath]);

      const timeout = setTimeout(() => this.cleanupExport(exportId), EXPORT_TTL_MS);
      this.pendingExports.set(exportId, { filePath: zipPath, createdAt: Date.now(), timeout });

      this.logger.log(
        `Dictionary export ${exportId} completed: ${processed} records in ${Date.now() - startedAt}ms, archive registered for ${EXPORT_TTL_MS / 1000}s`,
      );

      const finalChunk: ImportDictionaryChunkT = {
        percent: 100,
        stage: EnDictionaryImportPhasesE.completed,
        exportId,
      } as ImportDictionaryChunkT;
      res.write(JSON.stringify(finalChunk) + '\n');
    } finally {
      await Promise.allSettled([unlink(wordsPath), unlink(phrasesPath), unlink(grammarPath)]);
      res.end();
    }
  }

  private zipFiles(zipPath: string, files: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const zipFile = new yazl.ZipFile();
      for (const file of files) {
        zipFile.addFile(file, path.basename(file));
      }
      const output = createWriteStream(zipPath);
      output.on('close', resolve);
      output.on('error', reject);
      zipFile.outputStream.pipe(output);
      zipFile.end();
    });
  }

  private cleanupExport(exportId: string): void {
    const entry = this.pendingExports.get(exportId);
    if (!entry) return;
    this.pendingExports.delete(exportId);
    unlink(entry.filePath).catch(() => {});
    this.logger.log(`Export archive ${exportId} cleaned up`);
  }

  /**
   * Вызывается из контроллера отдельным GET-эндпоинтом для скачивания архива.
   */
  async streamExportFile(exportId: string, res: Response): Promise<void> {
    const entry = this.pendingExports.get(exportId);
    if (!entry || !existsSync(entry.filePath)) {
      this.logger.warn(`Download requested for missing or expired export ${exportId}`);
      throw new NotFoundException(ErrorCodes.internal_server_error);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="vocab-bloom-hub-en-export.zip"`);
    const { size } = await stat(entry.filePath);
    res.setHeader('Content-Length', size);

    const fileStream = createReadStream(entry.filePath);
    try {
      await pipeline(fileStream, res);
      this.logger.log(`Export archive ${exportId} downloaded (${size} bytes)`);
    } finally {
      clearTimeout(entry.timeout);
      this.cleanupExport(exportId);
    }
  }
}
