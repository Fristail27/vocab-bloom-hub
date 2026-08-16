import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsRelations, FindOptionsWhere, In, MoreThan, Not, Repository } from 'typeorm';
import * as yazl from 'yazl';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { stat, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Readable } from 'node:stream';
import * as readline from 'node:readline';
import { type Response } from 'express';
import { EnWord } from '../../entities/en_word.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { ImportDictionaryReq } from './dto/ImportDictionaryReq.dto';
import {
  DatasetManifestT,
  EnEntryTypesE,
  EnPartOfSpeechE,
  EnWordFormsE,
  EnWordT,
  ImportDictionaryChunkT,
} from '../../../../../types';
import { SettingsService } from '../../../SettingsModule/settings.service';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { getVersion } from '../../../../../configuration';
import {
  DATASET_FILE_NAMES,
  DATASET_VERSION_SETTINGS_FIELD,
  EnDictionaryImportPhasesE,
  LEGACY_DATASET_TOTAL_LINES,
  MANIFEST_FILE_NAME,
} from './constants';
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
// Dataset lines are imported in transactional chunks of this size; each chunk
// costs a handful of bulk queries instead of ~26 queries per line
const IMPORT_CHUNK_SIZE = 500;
// Keep IN (...) lists and multi-row VALUES well below the driver parameter
// limits (SQLite: 32766, Postgres: 65535)
const SQL_PARAMS_CHUNK = 500;
// The manifest endpoint proxies HuggingFace; cache it briefly so opening the
// import page repeatedly does not hammer the dataset host
const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class EnImportDictionaryService {
  private readonly logger = new Logger(EnImportDictionaryService.name);

  private readonly pendingExports = new Map<string, PendingExport>();

  private manifestCache: { manifest: DatasetManifestT; fetchedAt: number } | null = null;

  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    private readonly settingsService: SettingsService,
  ) {}

  private async fetchManifest(): Promise<DatasetManifestT | null> {
    try {
      const response = await fetch(`${DATASET_BASE_URL}/${MANIFEST_FILE_NAME}`);
      if (!response.ok) {
        this.logger.warn(`Dataset manifest request failed: HTTP ${response.status}`);
        return null;
      }

      const manifest = (await response.json()) as DatasetManifestT;
      const lineCounts = manifest?.files ? Object.values(manifest.files) : [];
      const isValid =
        typeof manifest?.version === 'string' &&
        lineCounts.length > 0 &&
        lineCounts.every((f) => typeof f?.lines === 'number' && f.lines >= 0);
      if (!isValid) {
        this.logger.warn('Dataset manifest has an unexpected shape, ignoring it');
        return null;
      }

      return manifest;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch the dataset manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * The version check the import UI runs before starting an import.
   * Serves a briefly cached copy of the published manifest.json.
   */
  async getManifest(): Promise<DatasetManifestT> {
    if (this.manifestCache && Date.now() - this.manifestCache.fetchedAt < MANIFEST_CACHE_TTL_MS) {
      return this.manifestCache.manifest;
    }

    const manifest = await this.fetchManifest();
    if (!manifest) {
      throw new NotFoundException(ErrorCodes.dataset_manifest_not_found);
    }

    this.manifestCache = { manifest, fetchedAt: Date.now() };
    return manifest;
  }

  private async streamJsonlImport<T>(
    res: Response,
    fileName: string,
    stage: EnDictionaryImportPhasesE,
    allLength: number,
    plusCount: () => number,
    handleChunk: (lines: T[]) => Promise<void>,
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
      let chunk: T[] = [];

      const flush = async () => {
        if (chunk.length === 0) return;
        const lines = chunk;
        chunk = [];
        await handleChunk(lines);
        let count = 0;
        for (let i = 0; i < lines.length; i++) count = plusCount();
        await this.reportImportProgress(res, count + 1, allLength, stage);
      };

      for await (const l of rl) {
        lineNo++;
        if (!l.trim()) continue;
        chunk.push(JSON.parse(l) as T);
        if (chunk.length >= IMPORT_CHUNK_SIZE) await flush();
      }
      await flush();

      this.logger.log(
        `Import stage "${stage}" finished: ${lineNo} lines from "${fileName}" in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.error(`Import of "${fileName}" failed`, error instanceof Error ? error.stack : String(error));
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
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

  // Called once per imported chunk; the tiny pause lets the progress stream flush
  private async reportImportProgress(
    res: Response,
    count: number,
    allLength: number,
    stage: EnDictionaryImportPhasesE,
  ): Promise<void> {
    const chunk: ImportDictionaryChunkT = {
      percent: Math.min(100, (count / allLength) * 100),
      stage,
    };
    res.write(JSON.stringify(chunk) + '\n');
    await new Promise((r) => setTimeout(r, 1));
  }

  private static chunked<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  private static wordKey(word: string, pos: string, form: string): string {
    return `${word}\u0000${pos}\u0000${form}`;
  }

  private static entryTypeOf(pos: EnPartOfSpeechE): EnEntryTypesE {
    if (pos === EnPartOfSpeechE.phrase) return EnEntryTypesE.phrase;
    if (pos === EnPartOfSpeechE.grammar_pattern) return EnEntryTypesE.grammar_pattern;
    return EnEntryTypesE.word;
  }

  // Loads the ids of base-form rows for the given entry spellings in bulk
  private async selectWordRows(
    em: EntityManager,
    names: string[],
  ): Promise<Array<{ id: number; word: string; pos: string; form: string }>> {
    const rows: Array<{ id: number; word: string; pos: string; form: string }> = [];
    for (const batch of EnImportDictionaryService.chunked(names, SQL_PARAMS_CHUNK)) {
      const raw = await em
        .getRepository(EnWord)
        .createQueryBuilder('w')
        .innerJoin('w.word', 'entry')
        .select('w.id', 'id')
        .addSelect('entry.word', 'word')
        .addSelect('w.part_of_speech', 'pos')
        .addSelect('w.form_of_word', 'form')
        .where('entry.word IN (:...batch)', { batch })
        .getRawMany<{ id: number; word: string; pos: string; form: string }>();
      rows.push(...raw);
    }
    return rows;
  }

  /**
   * Saves a chunk of dataset lines with bulk queries in one transaction.
   * Replays what EnService.addWord does per line — entry reuse, duplicate
   * skipping, base row + forms + meanings + translations — at a cost of a
   * handful of queries per chunk instead of ~26 per line.
   */
  private async bulkSaveWords(lines: EnWordT[]): Promise<void> {
    const { chunked, wordKey, entryTypeOf } = EnImportDictionaryService;

    await this.enWordsRep.manager.transaction(async (em) => {
      // 1. every entry spelling this chunk needs (base words + their forms)
      const entryTypes = new Map<string, EnEntryTypesE>();
      for (const line of lines) {
        if (!entryTypes.has(line.word)) entryTypes.set(line.word, entryTypeOf(line.part_of_speech));
        for (const f of line.forms ?? []) {
          if (!entryTypes.has(f.word)) entryTypes.set(f.word, EnEntryTypesE.word);
        }
      }
      const entryNames = [...entryTypes.keys()];

      // 2. reuse existing entries, insert the missing ones
      const existingEntries = new Set<string>();
      for (const batch of chunked(entryNames, SQL_PARAMS_CHUNK)) {
        const rows = await em.getRepository(EnEntry).find({ where: { word: In(batch) } });
        rows.forEach((r) => existingEntries.add(r.word));
      }
      const newEntries = entryNames
        .filter((w) => !existingEntries.has(w))
        .map((word) => ({ word, type: entryTypes.get(word) }));
      for (const batch of chunked(newEntries, SQL_PARAMS_CHUNK)) {
        await em.getRepository(EnEntry).insert(batch);
      }

      // 3. skip duplicates: rows with the same (word, pos, form) already in the DB
      const seen = new Set<string>();
      (await this.selectWordRows(em, entryNames)).forEach((r) => seen.add(wordKey(r.word, r.pos, r.form)));

      const toInsert: EnWordT[] = [];
      let skipped = 0;
      for (const line of lines) {
        const key = wordKey(line.word, line.part_of_speech, line.form_of_word);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        toInsert.push(line);
      }
      if (skipped > 0) {
        this.logger.log(`Skipped ${skipped} duplicate dataset lines in this chunk`);
      }
      if (toInsert.length === 0) return;

      // 4. base rows in bulk (nested structures stripped, entry linked by its string PK)
      const toBaseRow = (line: EnWordT) => {
        const {
          id: _id,
          word,
          base_phrasal: _basePhrasal,
          base_form: _baseForm,
          forms: _forms,
          meanings: _meanings,
          short_translations: _shortTranslations,
          phrasal_variants: _phrasalVariants,
          ...rest
        } = line;
        return { ...rest, word: { word } as EnEntry };
      };
      for (const batch of chunked(toInsert, SQL_PARAMS_CHUNK)) {
        await em.getRepository(EnWord).insert(batch.map(toBaseRow));
      }

      // 5. fetch the generated ids back by natural key
      const idByKey = new Map<string, number>();
      const insertedNames = [...new Set(toInsert.map((l) => l.word))];
      (await this.selectWordRows(em, insertedNames)).forEach((r) =>
        idByKey.set(wordKey(r.word, r.pos, r.form), r.id),
      );

      // 6. forms in bulk, deduplicated the same way base rows are
      const formRows = [];
      for (const line of toInsert) {
        const baseId = idByKey.get(wordKey(line.word, line.part_of_speech, line.form_of_word));
        for (const f of line.forms ?? []) {
          const key = wordKey(f.word, line.part_of_speech, f.form_of_word);
          if (seen.has(key)) continue;
          seen.add(key);
          const { id: _fid, word: formWord, ...fRest } = f;
          formRows.push({
            ...fRest,
            word: { word: formWord } as EnEntry,
            part_of_speech: line.part_of_speech,
            base_form: { id: baseId } as EnWord,
          });
        }
      }
      for (const batch of chunked(formRows, SQL_PARAMS_CHUNK)) {
        await em.getRepository(EnWord).insert(batch);
      }

      // 7. meanings need their generated ids for the nested translations, so they
      // go one insert per meaning (still inside the chunk transaction); the
      // translations and short translations then go in bulk
      const translationRows = [];
      const shortTranslationRows = [];
      for (const line of toInsert) {
        const wordId = idByKey.get(wordKey(line.word, line.part_of_speech, line.form_of_word));
        for (const m of line.meanings ?? []) {
          const { id: _mid, translations, ...mRest } = m;
          const res = await em.getRepository(EnMeaning).insert({ ...mRest, word: { id: wordId } as EnWord });
          const meaningId = res.identifiers[0]?.id as number;
          for (const t of translations ?? []) {
            const { id: _tid, ...tRest } = t;
            translationRows.push({ ...tRest, meaning: { id: meaningId } as EnMeaning });
          }
        }
        for (const st of line.short_translations ?? []) {
          const { id: _stid, ...stRest } = st;
          shortTranslationRows.push({ ...stRest, word: { id: wordId } as EnWord });
        }
      }
      for (const batch of chunked(translationRows, SQL_PARAMS_CHUNK)) {
        await em.getRepository(EnMeaningTranslation).insert(batch);
      }
      for (const batch of chunked(shortTranslationRows, SQL_PARAMS_CHUNK)) {
        await em.getRepository(EnShortTranslation).insert(batch);
      }
    });
  }

  // Links phrasal variants to their base verbs with one lookup per chunk
  private async bulkLinkPhrasalVerbs(lines: DataSetWordT[]): Promise<void> {
    await this.enWordsRep.manager.transaction(async (em) => {
      const names = new Set<string>();
      for (const line of lines) {
        names.add(line.word);
        line.phrasal_variants.forEach((v) => names.add(v));
      }

      const idByName = new Map<string, number>();
      (await this.selectWordRows(em, [...names]))
        .filter((r) => r.pos === EnPartOfSpeechE.verb && r.form === EnWordFormsE.base_form)
        .forEach((r) => idByName.set(r.word, r.id));

      for (const line of lines) {
        const baseId = idByName.get(line.word);
        if (!baseId) {
          this.logger.warn(`Phrasal base verb "${line.word}" is missing in the dataset, skipping its variants`);
          continue;
        }
        for (const variant of line.phrasal_variants) {
          const variantId = idByName.get(variant);
          if (!variantId) {
            this.logger.warn(
              `Phrasal variant "${variant}" of "${line.word}" is missing in the dataset, skipping`,
            );
            continue;
          }
          await em.getRepository(EnWord).update(variantId, { base_phrasal: { id: baseId } as EnWord });
        }
      }
    });
  }

  private async saveWords(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      res,
      DATASET_FILE_NAMES.words,
      EnDictionaryImportPhasesE.saving_words,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapWordFromSetToDB) as unknown as EnWordT[]);
      },
    );
  }

  private async saveGrammarPatterns(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetGrammarPatternT>(
      res,
      DATASET_FILE_NAMES.grammarPatterns,
      EnDictionaryImportPhasesE.saving_grammar_patterns,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapGrammarPatternFromSetToDB));
      },
    );
  }

  private async savePhrases(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetPhraseT>(
      res,
      DATASET_FILE_NAMES.phrases,
      EnDictionaryImportPhasesE.saving_phrases,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapPhraseFromSetToDB));
      },
    );
  }

  private async savePhrasalVerbs(res: Response, allLength: number, plusCount: () => number): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      res,
      DATASET_FILE_NAMES.phrasalVerbs,
      EnDictionaryImportPhasesE.saving_phrasal_verbs,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkLinkPhrasalVerbs(lines);
      },
    );
  }

  async importDictionary(body: ImportDictionaryReq, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const startedAt = Date.now();
    this.logger.log('Dictionary import started');

    const manifest = await this.fetchManifest();
    if (!manifest) {
      this.logger.warn('Dataset manifest is missing — progress totals fall back to the legacy line counts');
    }

    let count = 0;
    const plusCount = () => count++;
    const allLength = manifest
      ? Object.values(manifest.files).reduce((sum, f) => sum + f.lines, 0)
      : LEGACY_DATASET_TOTAL_LINES;

    const firstChunk: ImportDictionaryChunkT = {
      percent: 0,
      stage: EnDictionaryImportPhasesE.downloading_database,
      ...(manifest && { datasetVersion: manifest.version }),
    };
    res.write(JSON.stringify(firstChunk) + '\n');

    await this.saveWords(res, allLength, plusCount);
    await this.savePhrasalVerbs(res, allLength, plusCount);
    await this.saveGrammarPatterns(res, allLength, plusCount);
    await this.savePhrases(res, allLength, plusCount);

    if (manifest) {
      // Remember which dataset version this database now holds; a failure
      // here must not fail an already completed import
      await this.settingsService.upsert(DATASET_VERSION_SETTINGS_FIELD, manifest.version).catch((error) => {
        this.logger.warn(
          `Failed to store the imported dataset version: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }

    const finalChunk: ImportDictionaryChunkT = {
      percent: 100,
      stage: EnDictionaryImportPhasesE.completed,
      ...(manifest && { datasetVersion: manifest.version }),
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
    // prepare may return null to skip a record (e.g. verbs without phrasal variants)
    prepare: (word: EnWord) => T | null,
    onProgress: (percent: number, stage: EnDictionaryImportPhasesE) => void,
  ): Promise<number> {
    const outStream = createWriteStream(outPath, { encoding: 'utf-8' });
    const batchSize = 200;
    let lastId = 0;
    let written = 0;

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
          if (prepared === null) continue;
          const cleaned = cleanEntity(prepared);
          outStream.write(JSON.stringify(cleaned) + '\n');
          written++;
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

    return written;
  }

  /**
   * Собирает 4 jsonl-файла и manifest.json во временной папке, упаковывает
   * их в zip, регистрирует архив под exportId и возвращает этот id.
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

    const wordsPath = path.join(runDir, DATASET_FILE_NAMES.words);
    const phrasalVerbsPath = path.join(runDir, DATASET_FILE_NAMES.phrasalVerbs);
    const phrasesPath = path.join(runDir, DATASET_FILE_NAMES.phrases);
    const grammarPath = path.join(runDir, DATASET_FILE_NAMES.grammarPatterns);
    const manifestPath = path.join(runDir, MANIFEST_FILE_NAME);
    const zipPath = path.join(tmpDir, `${exportId}.zip`);

    const startedAt = Date.now();
    // the phrasal-verbs stage walks the base verbs a second time, so they
    // count into the progress total twice
    const baseTotal = await this.enWordsRep.count({ where: { form_of_word: EnWordFormsE.base_form } });
    const verbTotal = await this.enWordsRep.count({
      where: { form_of_word: EnWordFormsE.base_form, part_of_speech: EnPartOfSpeechE.verb },
    });
    const total = baseTotal + verbTotal;
    this.logger.log(`Dictionary export ${exportId} started: ${baseTotal} base records to export`);

    let processed = 0;
    const addProcessed = (n: number) => (processed += n);
    const emit = (percent: number, stage: EnDictionaryImportPhasesE) => {
      const chunk: ImportDictionaryChunkT = { percent, stage };
      res.write(JSON.stringify(chunk) + '\n');
    };

    try {
      const wordsLines = await this.exportEntities(
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

      // The linking map the import replays in savePhrasalVerbs: one line per
      // base verb that has phrasal variants
      const phrasalVerbsLines = await this.exportEntities(
        phrasalVerbsPath,
        total,
        () => processed,
        addProcessed,
        EnDictionaryImportPhasesE.saving_phrasal_verbs,
        { part_of_speech: EnPartOfSpeechE.verb },
        { word: true, phrasal_variants: { word: true } },
        (w) =>
          w.phrasal_variants?.length
            ? { word: w.word.word, phrasal_variants: w.phrasal_variants.map((v) => v.word.word) }
            : null,
        emit,
      );

      const phrasesLines = await this.exportEntities(
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

      const grammarLines = await this.exportEntities(
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

      // The manifest travels inside the archive, so the published dataset
      // always carries line counts matching its jsonl files (issue #159)
      const manifest: DatasetManifestT = {
        version: getVersion(),
        generatedAt: new Date().toISOString(),
        files: {
          [DATASET_FILE_NAMES.words]: { lines: wordsLines },
          [DATASET_FILE_NAMES.phrasalVerbs]: { lines: phrasalVerbsLines },
          [DATASET_FILE_NAMES.grammarPatterns]: { lines: grammarLines },
          [DATASET_FILE_NAMES.phrases]: { lines: phrasesLines },
        },
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

      emit(100, EnDictionaryImportPhasesE.packing_archive);
      await this.zipFiles(zipPath, [wordsPath, phrasalVerbsPath, phrasesPath, grammarPath, manifestPath]);

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
      await Promise.allSettled([
        unlink(wordsPath),
        unlink(phrasalVerbsPath),
        unlink(phrasesPath),
        unlink(grammarPath),
        unlink(manifestPath),
      ]);
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
