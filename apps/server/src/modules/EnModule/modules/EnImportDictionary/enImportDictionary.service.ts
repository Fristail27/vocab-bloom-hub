import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import * as readline from 'node:readline';
import { type Response } from 'express';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnWord } from '../../entities/en_word.entity';
import { ImportDictionaryReq } from './dto/ImportDictionaryReq.dto';
import {
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  ImportDictionaryChunkT,
  LanguageRegisterE,
} from '../../../../../types';
import { EnService } from '../../en.service';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { EnDictionaryImportPhasesE } from './constants';
import { cleanEntity, prepareWordForDataSet } from './utils';
import { DataSetWordT } from '../../../../../types/dictionaries/en/EnDataSetTypes';

@Injectable()
export class EnImportDictionaryService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    private readonly enService: EnService,
  ) {}
  async importDictionary(body: ImportDictionaryReq, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const url =
      'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en/resolve/main/data/vocab-bloom-hub-en-words.jsonl';

    const response = await fetch(url);

    if (!response.ok) {
      //TODO
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    if (!response.body) {
      //TODO
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
    const stream = Readable.fromWeb(response.body as any);

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let count = 0;
    const allLength = 88849 + 912;
    const phrasalVerbsConfig: Record<string, string[]> = {};
    for await (const l of rl) {
      count += 1;
      if (!l.trim()) continue;

      try {
        const line: DataSetWordT = JSON.parse(l);
        if (line.part_of_speech === EnPartOfSpeechE.verb && line.phrasal_variants?.length > 0) {
          phrasalVerbsConfig[line.word] = line.phrasal_variants;
        }
        await this.enService.addWord({
          word: line.word,
          part_of_speech: line.part_of_speech,
          pattern: null,
          form_of_word: EnWordFormsE.base_form,
          area_variant: line.area_variant || EnAreaVariantsE.common,
          generated_by_model: line.generated_by_model,
          generated: !!line.generated,
          verb___phrasal_object_pattern: line.verb___phrasal_object_pattern || null,
          verb___transitivity: line.verb___transitivity || null,
          language_register: line.language_register || LanguageRegisterE.formal,
          categories: line.categories || [],
          verb___is_phrasal: !!line.verb___is_phrasal,
          verb___is_irregular: !!line.verb___is_irregular,
          noun___is_proper: !!line.noun___is_proper,
          word_level: line.word_level || null,
          description: line.description,
          transcription: line.transcription,
          is_obsolete: line.is_obsolete,
          is_abbreviation: line.is_abbreviation,
          noun___uncountable: line.noun___uncountable,
          noun___irregular_plural: line.noun___irregular_plural,
          id: 0,
          noun___always_plural: line.noun___always_plural,
          base_phrasal: undefined,
          base_form: undefined,
          phrasal_variants: [],
          forms: line.forms.map((w) => ({ ...w, id: 0 })),
          short_translations: line.short_translations.map((s) => ({ id: 0, ...s })),
          meanings: line.meanings.map((m) => ({
            ...m,
            id: 0,
            meaning_level: m.meaning_level || null,
            language_register: m.language_register || LanguageRegisterE.formal,
            area_variant: m.area_variant || EnAreaVariantsE.common,
            translations: m.translations.map((t) => ({ id: 0, ...t })),
          })),
        });
        if (count % 50 === 0) {
          const chunk: ImportDictionaryChunkT = {
            percent: (count / allLength) * 100,
            stage: EnDictionaryImportPhasesE.saving_words,
          };
          res.write(JSON.stringify(chunk) + '\n');
          await new Promise((r) => setTimeout(r, 1));
        }
      } catch (error: any) {
        if ('message' in error && error?.message === ErrorCodes.word_already_exists) {
          if (count % 50 === 0) {
            const chunk: ImportDictionaryChunkT = {
              percent: (count / allLength) * 100,
              stage: EnDictionaryImportPhasesE.saving_words,
            };
            res.write(JSON.stringify(chunk) + '\n');
            await new Promise((r) => setTimeout(r, 1));
          }
        } else {
          console.log(error);
          throw new InternalServerErrorException(ErrorCodes.internal_server_error);
        }
      }
    }

    const phrasalVerbs = Object.entries(phrasalVerbsConfig);
    let phrasalCount = 0;
    for (const p of phrasalVerbs) {
      const [phWord, variants] = p;
      const wordEntity = await this.enService.getWordRow(phWord, EnPartOfSpeechE.verb, EnWordFormsE.base_form);

      if (!wordEntity) {
        throw new InternalServerErrorException(ErrorCodes.word_doesnt_found);
      }

      for (const w of variants) {
        phrasalCount += 1;
        const variantEntity = await this.enService.getWordRow(w, EnPartOfSpeechE.verb, EnWordFormsE.base_form);
        if (!variantEntity) {
          throw new InternalServerErrorException(ErrorCodes.word_doesnt_found);
        }

        variantEntity.base_phrasal = wordEntity;
        await this.enWordsRep.save(variantEntity);

        if (phrasalCount % 50 === 0) {
          const chunk: ImportDictionaryChunkT = {
            percent: ((count + phrasalCount) / allLength) * 100,
            stage: EnDictionaryImportPhasesE.saving_phrasal_verbs,
          };
          res.write(JSON.stringify(chunk) + '\n');
          await new Promise((r) => setTimeout(r, 1));
        }
      }
    }

    res.end();
  }

  async exportDictionary(res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const outPath = '/Users/aleksejryzov/Downloads/dictionary_export.jsonl';
    const outStream = createWriteStream(outPath, { encoding: 'utf-8' });

    const total = await this.enWordsRep.count({
      where: { form_of_word: EnWordFormsE.base_form },
    });
    const batchSize = 200;
    let processed = 0;
    let lastId = 0;

    try {
      while (true) {
        const batch = await this.enWordsRep.find({
          where: { id: MoreThan(lastId), form_of_word: EnWordFormsE.base_form },
          order: { id: 'ASC' },
          take: batchSize,
          relations: {
            base_phrasal: { word: true },
            phrasal_variants: { word: true },
            word: true,
            forms: { word: true },
            short_translations: true,
            meanings: { translations: true },
          },
        });

        if (batch.length === 0) break;

        for (const word of batch) {
          const w = prepareWordForDataSet(word);
          const cleaned = cleanEntity(w);
          outStream.write(JSON.stringify(cleaned) + '\n');
        }

        lastId = batch[batch.length - 1].id;
        processed += batch.length;

        const chunk: ImportDictionaryChunkT = {
          percent: (processed / total) * 100,
          stage: EnDictionaryImportPhasesE.saving_words,
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

    res.end();
  }
}
