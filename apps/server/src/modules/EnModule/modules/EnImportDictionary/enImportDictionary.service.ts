import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MetricsService } from '../../../MetricsModule/metrics.service';
import { EntityManager, FindOptionsRelations, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import * as yazl from 'yazl';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { stat, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';
import { type Response } from 'express';
import { EnWord } from '../../entities/en_word.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { normalizeWordLinks, WORD_LINK_KINDS, WordLinkKindT } from '../../utils/normalizeWordLinks';
import { resolveBaseFormHeadwords } from '../../utils/findBaseFormHeadwords';
import { ImportDictionaryReq, ImportDictionarySourceDTO } from './dto/ImportDictionaryReq.dto';
import {
  DatasetManifestT,
  EnEntryTypesE,
  EnPartOfSpeechE,
  EnWordFormsE,
  EnWordT,
  ImportDictionaryChunkT,
  ImportSourceKindE,
  ImportSourcesT,
} from '../../../../../types';
import { SettingsService } from '../../../SettingsModule/settings.service';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { DATA_LICENSE } from '../../../../../core/constants/data_license';
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
  compareExportLineKeys,
  mapGrammarPatternFromSetToDB,
  mapWordFromSetToDB,
  prepareGrammarPatternForDataSet,
  preparePhraseForDataSet,
  prepareWordForDataSet,
  sortStrings,
} from './utils';
import {
  DataSetGrammarPatternT,
  DataSetPhraseT,
  DataSetWordT,
} from '../../../../../types/dictionaries/en/EnDataSetTypes';
import { mapPhraseFromSetToDB } from './utils/mapPhraseFromSetToDB';
import { PendingExport, PendingWordLinkT } from './types';
import {
  DatasetSource,
  fetchPublishedManifest,
  getImportDir,
  HuggingFaceDatasetSource,
  listImportDir,
  ManualManifestT,
  openImportDirSource,
  openUploadedDatasetSource,
  UploadedFilesByFieldT,
} from './sources';

type PendingWordLinksT = Record<WordLinkKindT, PendingWordLinkT[]>;
const LINK_LABELS: Record<WordLinkKindT, string> = { synonyms: 'Synonym', antonyms: 'Antonym' };
const LINK_STAGES: Record<WordLinkKindT, EnDictionaryImportPhasesE> = {
  synonyms: EnDictionaryImportPhasesE.linking_synonyms,
  antonyms: EnDictionaryImportPhasesE.linking_antonyms,
};
const linkKey = (meaningId: number, word: string): string => `${meaningId}\u0000${word}`;

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
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /**
   * The version check the import UI runs before starting an import.
   * Serves a briefly cached copy of the published manifest.json.
   */
  async getManifest(): Promise<DatasetManifestT> {
    if (this.manifestCache && Date.now() - this.manifestCache.fetchedAt < MANIFEST_CACHE_TTL_MS) {
      return this.manifestCache.manifest;
    }

    const manifest = await fetchPublishedManifest(this.logger);
    if (!manifest) {
      throw new NotFoundException(ErrorCodes.dataset_manifest_not_found);
    }

    this.manifestCache = { manifest, fetchedAt: Date.now() };
    return manifest;
  }

  private async streamJsonlImport<T>(
    source: DatasetSource,
    res: Response,
    fileName: string,
    stage: EnDictionaryImportPhasesE,
    allLength: number,
    plusCount: () => number,
    handleChunk: (lines: T[]) => Promise<void>,
  ): Promise<void> {
    const { path: filePath, temporary } = await source.acquireFile(fileName, res);
    if (!filePath) {
      this.logger.warn(`Dataset file "${fileName}" is absent from the source, stage "${stage}" skipped`);
      return;
    }

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
      // downloads are deleted once imported; a user's own files never are
      if (temporary) await unlink(filePath).catch(() => {});
    }
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
    this.metrics?.transferProgressed('import', EnDictionaryImportPhasesE[stage], chunk.percent);
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
  private async bulkSaveWords(lines: EnWordT[], pendingLinks?: PendingWordLinksT): Promise<void> {
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
          const { id: _mid, translations, synonyms, antonyms, ...mRest } = m;
          const res = await em.getRepository(EnMeaning).insert({ ...mRest, word: { id: wordId } as EnWord });
          const meaningId = res.identifiers[0]?.id as number;
          // synonyms / antonyms link to entries that may only appear later in the
          // dataset (or in another file), so they are resolved once every file is in
          for (const kind of WORD_LINK_KINDS) {
            const words = normalizeWordLinks(kind === 'synonyms' ? synonyms : antonyms, line.word);
            if (pendingLinks && words.length > 0) {
              pendingLinks[kind].push({ meaningId, headword: line.word, words });
            }
          }
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

  /**
   * Links (synonyms or antonyms) the export writes: one per linked word of
   * every base-form meaning. Recorded in the manifest so the import can count
   * the linking stage into its progress total.
   */
  private async countExportedLinks(kind: WordLinkKindT): Promise<number> {
    const row = await this.enWordsRep.manager
      .getRepository(EnMeaning)
      .createQueryBuilder('m')
      .innerJoin(`m.${kind}`, 'l')
      .innerJoin('m.word', 'w')
      .where('w.form_of_word = :baseForm', { baseForm: EnWordFormsE.base_form })
      .select('COUNT(*)', 'cnt')
      .getRawOne<{ cnt: unknown }>();
    return Number(row?.cnt) || 0;
  }

  /**
   * Inserts the meaning → entry links of one kind collected while saving the
   * dataset. Words the dictionary does not have are skipped with a warning,
   * the same way unknown phrasal variants are. A word already linked as a
   * synonym of the meaning is skipped as an antonym (the admin API rejects
   * such a pair; the dataset is assumed authored through it).
   */
  private async bulkLinkWords(
    kind: WordLinkKindT,
    pending: PendingWordLinkT[],
    onBatchDone?: (processedLinks: number) => Promise<void>,
  ): Promise<void> {
    const { chunked } = EnImportDictionaryService;
    if (pending.length === 0) return;

    // the junction table is owned by the ManyToMany relation, so its name is read from the metadata
    const junctionTable = this.enWordsRep.manager.connection
      .getMetadata(EnMeaning)
      .findRelationWithPropertyPath(kind)?.junctionEntityMetadata?.tableName;
    if (!junctionTable) {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    let skipped = 0;
    for (const batch of chunked(pending, IMPORT_CHUNK_SIZE)) {
      await this.enWordsRep.manager.transaction(async (em) => {
        // only base-form headwords qualify (directly or through a spelling
        // variant), the same rule the admin API applies
        const names = [...new Set(batch.flatMap((p) => p.words))];
        const resolved = new Map<string, string>();
        for (const nameBatch of chunked(names, SQL_PARAMS_CHUNK)) {
          (await resolveBaseFormHeadwords(em, nameBatch)).forEach((headword, name) =>
            resolved.set(name, headword),
          );
        }
        const taken = kind === 'antonyms' ? await this.loadSynonymKeys(em, batch) : new Set<string>();

        const links: Array<{ meaning_id: number; word: string }> = [];
        const seen = new Set<string>();
        for (const p of batch) {
          for (const name of p.words) {
            const headword = resolved.get(name);
            if (headword === undefined) {
              skipped++;
              this.logger.debug(
                `${LINK_LABELS[kind]} "${name}" of "${p.headword}" is missing in the dictionary, skipping`,
              );
              continue;
            }
            // two spellings may resolve to one word; the headword itself is never its own link
            const key = linkKey(p.meaningId, headword);
            if (headword === p.headword || seen.has(key)) continue;
            if (taken.has(key)) {
              skipped++;
              this.logger.warn(
                `"${headword}" is already a synonym of "${p.headword}", skipping it as an antonym`,
              );
              continue;
            }
            seen.add(key);
            links.push({ meaning_id: p.meaningId, word: headword });
          }
        }
        for (const linkBatch of chunked(links, SQL_PARAMS_CHUNK)) {
          await em.createQueryBuilder().insert().into(junctionTable).values(linkBatch).execute();
        }
      });
      // every collected link counts as processed, resolved or skipped
      await onBatchDone?.(batch.reduce((n, p) => n + p.words.length, 0));
    }
    if (skipped > 0) {
      this.logger.warn(
        `Skipped ${skipped} ${LINK_LABELS[kind].toLowerCase()} that name words missing in the dictionary or already linked`,
      );
    }
  }

  /** `meaning\0word` keys of the synonym links already stored for the given meanings */
  private async loadSynonymKeys(em: EntityManager, batch: PendingWordLinkT[]): Promise<Set<string>> {
    const { chunked } = EnImportDictionaryService;
    const keys = new Set<string>();
    for (const ids of chunked(
      batch.map((p) => p.meaningId),
      SQL_PARAMS_CHUNK,
    )) {
      const rows = await em.getRepository(EnMeaning).find({
        where: { id: In(ids) },
        relations: { synonyms: true },
        select: { id: true, synonyms: { word: true } },
      });
      for (const m of rows) for (const e of m.synonyms) keys.add(linkKey(m.id, e.word));
    }
    return keys;
  }

  /** Writes the collected links of both kinds, each as its own progress stage */
  private async linkPendingWords(
    res: Response,
    pendingLinks: PendingWordLinksT,
    allLength: number,
    getCount: () => number,
    addCount: (n: number) => void,
  ): Promise<void> {
    for (const kind of WORD_LINK_KINDS) {
      const pending = pendingLinks[kind];
      if (pending.length === 0) continue;
      const stage = LINK_STAGES[kind];
      const linkStartedAt = Date.now();
      await this.reportImportProgress(res, getCount(), allLength, stage);
      await this.bulkLinkWords(kind, pending, async (processedLinks) => {
        addCount(processedLinks);
        await this.reportImportProgress(res, getCount(), allLength, stage);
      });
      this.logger.log(`Linked ${kind} of ${pending.length} meanings in ${Date.now() - linkStartedAt}ms`);
    }
  }

  private async saveWords(
    source: DatasetSource,
    res: Response,
    allLength: number,
    plusCount: () => number,
    pendingLinks: PendingWordLinksT,
  ): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      source,
      res,
      DATASET_FILE_NAMES.words,
      EnDictionaryImportPhasesE.saving_words,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapWordFromSetToDB) as unknown as EnWordT[], pendingLinks);
      },
    );
  }

  private async saveGrammarPatterns(
    source: DatasetSource,
    res: Response,
    allLength: number,
    plusCount: () => number,
    pendingLinks: PendingWordLinksT,
  ): Promise<void> {
    await this.streamJsonlImport<DataSetGrammarPatternT>(
      source,
      res,
      DATASET_FILE_NAMES.grammarPatterns,
      EnDictionaryImportPhasesE.saving_grammar_patterns,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapGrammarPatternFromSetToDB), pendingLinks);
      },
    );
  }

  private async savePhrases(
    source: DatasetSource,
    res: Response,
    allLength: number,
    plusCount: () => number,
    pendingLinks: PendingWordLinksT,
  ): Promise<void> {
    await this.streamJsonlImport<DataSetPhraseT>(
      source,
      res,
      DATASET_FILE_NAMES.phrases,
      EnDictionaryImportPhasesE.saving_phrases,
      allLength,
      plusCount,
      async (lines) => {
        await this.bulkSaveWords(lines.map(mapPhraseFromSetToDB), pendingLinks);
      },
    );
  }

  private async savePhrasalVerbs(
    source: DatasetSource,
    res: Response,
    allLength: number,
    plusCount: () => number,
  ): Promise<void> {
    await this.streamJsonlImport<DataSetWordT>(
      source,
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

  /**
   * Opens the dataset source named by the request. Every check that can
   * reject the request (unknown path, malformed dataset) runs here, before
   * the progress stream starts, so the client still gets a plain 4xx.
   */
  private async openSource(source: ImportDictionarySourceDTO | undefined): Promise<DatasetSource> {
    if (!source || source.kind === ImportSourceKindE.huggingface) {
      return new HuggingFaceDatasetSource(this.logger);
    }
    if (source.kind === ImportSourceKindE.file) {
      return openImportDirSource(source.path ?? '', this.logger);
    }
    throw new BadRequestException(ErrorCodes.dataset_file_not_found);
  }

  /** What the "from file" tab of the import page can offer: server-side datasets */
  async getImportSources(): Promise<ImportSourcesT> {
    return { import_dir_configured: getImportDir() !== null, files: await listImportDir() };
  }

  async importDictionary(body: ImportDictionaryReq, res: Response): Promise<void> {
    const source = await this.openSource(body.source);
    const label = body.source?.kind === ImportSourceKindE.file ? `file "${body.source.path}"` : 'HuggingFace';
    await this.runImport(source, label, res);
  }

  /**
   * Imports what the multipart endpoint received: one archive, or the dataset
   * files one by one. The uploads are deleted afterwards whether or not the
   * import succeeded.
   */
  async importUploadedDictionary(
    files: UploadedFilesByFieldT,
    manual: ManualManifestT,
    res: Response,
  ): Promise<void> {
    const source = await openUploadedDatasetSource(files, manual, this.logger);
    const names = Object.values(files)
      .flat()
      .map((f) => `"${f.originalname}"`);
    await this.runImport(source, `upload ${names.join(', ')}`, res);
  }

  /** The import pipeline shared by every source; the source is disposed at the end */
  private async runImport(source: DatasetSource, label: string, res: Response): Promise<void> {
    // the manifest is read before the stream opens: a local source has
    // already validated it, HuggingFace may be unreachable
    const manifest = await source.readManifest();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const startedAt = Date.now();
    this.logger.log(`Dictionary import from ${label} started`);

    if (!manifest) {
      this.logger.warn('Dataset manifest is missing — progress totals fall back to the legacy line counts');
    }

    let count = 0;
    const plusCount = () => count++;
    // the linking stages count one unit per synonym / antonym link named in
    // the dataset; manifests published before #259 / #266 carry no link counts
    // and fall back to a single progress chunk for that stage
    const allLength = manifest
      ? Object.values(manifest.files).reduce((sum, f) => sum + f.lines, 0) +
        (manifest.synonym_links ?? 0) +
        (manifest.antonym_links ?? 0)
      : LEGACY_DATASET_TOTAL_LINES;

    // a local dataset has nothing to download: its first stage is the words
    // file; a dataset without a manifest has no version to report
    const datasetVersion = manifest?.version || undefined;
    const firstChunk: ImportDictionaryChunkT = {
      percent: 0,
      stage:
        source instanceof HuggingFaceDatasetSource
          ? EnDictionaryImportPhasesE.downloading_database
          : EnDictionaryImportPhasesE.saving_words,
      ...(datasetVersion && { datasetVersion }),
    };
    res.write(JSON.stringify(firstChunk) + '\n');
    this.metrics?.transferStarted('import');

    try {
      // meaning → synonym / antonym links are collected across every file and
      // written last, once all the entries they can point at exist
      const pendingLinks: PendingWordLinksT = { synonyms: [], antonyms: [] };
      await this.saveWords(source, res, allLength, plusCount, pendingLinks);
      await this.savePhrasalVerbs(source, res, allLength, plusCount);
      await this.saveGrammarPatterns(source, res, allLength, plusCount, pendingLinks);
      await this.savePhrases(source, res, allLength, plusCount, pendingLinks);
      await this.linkPendingWords(
        res,
        pendingLinks,
        allLength,
        () => count,
        (n) => {
          count += n;
        },
      );
    } catch (error) {
      this.metrics?.transferFinished('import', 'failure');
      throw error;
    } finally {
      await source.dispose().catch((error) => {
        this.logger.warn(
          `Failed to clean up the dataset source: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }

    if (datasetVersion) {
      // Remember which dataset version this database now holds; a failure
      // here must not fail an already completed import
      await this.settingsService.upsert(DATASET_VERSION_SETTINGS_FIELD, datasetVersion).catch((error) => {
        this.logger.warn(
          `Failed to store the imported dataset version: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }

    const finalChunk: ImportDictionaryChunkT = {
      percent: 100,
      stage: EnDictionaryImportPhasesE.completed,
      ...(datasetVersion && { datasetVersion }),
    };
    res.write(JSON.stringify(finalChunk) + '\n');
    this.metrics?.transferFinished('import', 'success');

    res.end();

    this.logger.log(
      `Dictionary import from ${label} completed: ${count} records in ${Date.now() - startedAt}ms`,
    );
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
    let written = 0;

    try {
      // Lines are written in natural-key order (word, part of speech, area
      // variant), not in id order: the ids differ between databases and the
      // published files must not depend on them (issue #247). The keys are
      // sorted in JS so the order does not depend on the DB collation either.
      const keys = await this.enWordsRep.find({
        select: { id: true, part_of_speech: true, area_variant: true, word: { word: true } },
        relations: { word: true },
        where: { form_of_word: EnWordFormsE.base_form, ...whereExtra },
      });
      const orderedKeys = keys
        .map((k) => ({
          id: k.id,
          word: k.word.word,
          part_of_speech: k.part_of_speech,
          area_variant: k.area_variant,
        }))
        .sort(compareExportLineKeys);

      for (let offset = 0; offset < orderedKeys.length; offset += batchSize) {
        const chunk = orderedKeys.slice(offset, offset + batchSize);
        const rows = await this.enWordsRep.find({ where: { id: In(chunk.map((k) => k.id)) }, relations });
        const rowsById = new Map(rows.map((row) => [row.id, row]));

        for (const key of chunk) {
          const word = rowsById.get(key.id);
          if (!word) continue;
          const prepared = prepare(word);
          if (prepared === null) continue;
          const cleaned = cleanEntity(prepared);
          outStream.write(JSON.stringify(cleaned) + '\n');
          written++;
        }

        addProcessed(chunk.length);

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
      this.metrics?.transferProgressed('export', EnDictionaryImportPhasesE[stage], percent);
    };
    this.metrics?.transferStarted('export');

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
          meanings: { translations: true, synonyms: { entries: true }, antonyms: { entries: true } },
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
            ? { word: w.word.word, phrasal_variants: sortStrings(w.phrasal_variants.map((v) => v.word.word)) }
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
        {
          word: true,
          short_translations: true,
          meanings: { translations: true, synonyms: { entries: true }, antonyms: { entries: true } },
        },
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
        {
          word: true,
          short_translations: true,
          meanings: { translations: true, synonyms: { entries: true }, antonyms: { entries: true } },
        },
        prepareGrammarPatternForDataSet,
        emit,
      );

      // The manifest travels inside the archive, so the published dataset
      // always carries line counts matching its jsonl files (issue #159)
      const manifest: DatasetManifestT = {
        version: getVersion(),
        generatedAt: new Date().toISOString(),
        license: DATA_LICENSE.spdx,
        attribution: DATA_LICENSE.attribution,
        synonym_links: await this.countExportedLinks('synonyms'),
        antonym_links: await this.countExportedLinks('antonyms'),
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
      this.metrics?.transferFinished('export', 'success');
    } catch (error) {
      this.metrics?.transferFinished('export', 'failure');
      throw error;
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
