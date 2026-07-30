import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, In, MoreThan, Not, Repository } from 'typeorm';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { unlink } from 'node:fs/promises';
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

const DATASET_BASE_URL = 'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en/resolve/main/data';

@Injectable()
export class EnImportDictionaryService {
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

    try {
      const rl = readline.createInterface({
        input: createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      for await (const l of rl) {
        if (!l.trim()) continue;
        const count = plusCount();

        try {
          const line: T = JSON.parse(l);
          await handleLine(line);
        } catch (error: any) {
          if (!('message' in error) || error?.message !== ErrorCodes.word_already_exists) {
            throw new InternalServerErrorException(ErrorCodes.internal_server_error);
          }
        }

        await this.reportImportProgress(res, count, allLength, stage);
      }
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

    const response = await fetch(`${DATASET_BASE_URL}/${fileName}`);
    if (!response.ok || !response.body) {
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
      percent: (count / allLength) * 100,
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
          throw new InternalServerErrorException(ErrorCodes.word_doesnt_found);
        }

        for (const w of phrasal_variants) {
          const count = plusCount();
          const variantEntity = await this.enService.getWordRow(
            w,
            EnPartOfSpeechE.verb,
            EnWordFormsE.base_form,
          );
          if (!variantEntity) {
            throw new InternalServerErrorException(ErrorCodes.word_doesnt_found);
          }

          variantEntity.base_phrasal = wordEntity;
          await this.enWordsRep.save(variantEntity);

          await this.reportImportProgress(
            res,
            count,
            allLength,
            EnDictionaryImportPhasesE.saving_phrasal_verbs,
          );
        }
      },
    );
  }

  async importDictionary(body: ImportDictionaryReq, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    let count = 0;
    const plusCount = () => count++;
    const allLength = 87074 + 912 + 28560 + 28;
    await this.reportImportProgress(res, count, allLength, EnDictionaryImportPhasesE.downloading_database);

    await this.saveWords(res, allLength, plusCount);
    await this.reportImportProgress(res, count, allLength, EnDictionaryImportPhasesE.downloading_database);

    await this.savePhrasalVerbs(res, allLength, plusCount);
    await this.reportImportProgress(res, count, allLength, EnDictionaryImportPhasesE.downloading_database);
    await this.saveGrammarPatterns(res, allLength, plusCount);
    await this.reportImportProgress(res, count, allLength, EnDictionaryImportPhasesE.downloading_database);
    await this.savePhrases(res, allLength, plusCount);

    res.end();
  }

  private async exportEntities<T>(
    res: Response,
    total: number,
    outPath: string,
    stage: EnDictionaryImportPhasesE,
    whereExtra: FindOptionsWhere<EnWord>,
    relations: FindOptionsRelations<EnWord>,
    prepare: (word: EnWord) => T,
  ): Promise<void> {
    const outStream = createWriteStream(outPath, { encoding: 'utf-8' });
    const batchSize = 200;
    let processed = 0;
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
        processed += batch.length;

        const chunk: ImportDictionaryChunkT = {
          percent: (processed / total) * 100,
          stage,
        };
        res.write(JSON.stringify(chunk) + '\n');
        await new Promise((r) => setTimeout(r, 1));
      }
    } catch {
      outStream.close();
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    await new Promise<void>((resolve, reject) => {
      outStream.end((err?: Error) => (err ? reject(err) : resolve()));
    });
  }

  private async exportWords(res: Response, total: number): Promise<void> {
    await this.exportEntities(
      res,
      total,
      '/Users/aleksejryzov/Downloads/vocab-bloom-hub-en-words.jsonl',
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
    );
  }

  private async exportPhrases(res: Response, total: number): Promise<void> {
    await this.exportEntities(
      res,
      total,
      '/Users/aleksejryzov/Downloads/vocab-bloom-hub-en-phrases.jsonl',
      EnDictionaryImportPhasesE.saving_words,
      { part_of_speech: EnPartOfSpeechE.phrase },
      { word: true, short_translations: true, meanings: { translations: true } },
      preparePhraseForDataSet,
    );
  }

  private async exportGrammarPatterns(res: Response, total: number): Promise<void> {
    await this.exportEntities(
      res,
      total,
      '/Users/aleksejryzov/Downloads/vocab-bloom-hub-en-grammar-patterns.jsonl',
      EnDictionaryImportPhasesE.saving_grammar_patterns,
      { part_of_speech: EnPartOfSpeechE.grammar_pattern },
      { word: true, short_translations: true, meanings: { translations: true } },
      prepareGrammarPatternForDataSet,
    );
  }

  async exportDictionary(res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const total = await this.enWordsRep.count({
      where: { form_of_word: EnWordFormsE.base_form },
    });
    await this.exportWords(res, total);
    await this.exportPhrases(res, total);
    await this.exportGrammarPatterns(res, total);

    res.end();
  }
}
