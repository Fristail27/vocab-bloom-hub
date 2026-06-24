import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { EnEntry } from './entities/en_entry.entity';
import { EnWord } from './entities/en_word.entity';
import {
  AddResT,
  AddWordFormResT,
  DeleteResT,
  EditCommonInfoOfWordResT,
  EditPhrasalBaseResT,
  EditWordFormResT,
  EnEntryTypesE,
  EnPartOfSpeechE,
  EnWordFormsE,
  EnWordFormT,
  EnWordT,
} from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { mapSearchResults } from './utils/mapSearchResults';
import { prepareWordFromDB } from './utils/prepareWordFromDB';
import { AddWordFormReqDTO } from './dto/AddWordFormReq.dto';
import { EditWordFormReqDTO } from './dto/EditWordFormReq.dto';
import { EditCommonInfoOfWordReqDTO } from './dto/EditCommonInfoOfWordReq.dto';
import { EnShortTranslationService } from './modules/EnShortTranslation/enShortTranslation.service';
import { EnMeaningService } from './modules/EnMeaning/enMeaning.service';
import { EditPhrasalBaseReqDTO } from './dto/EditPhrasalBase.dto';

@Injectable()
export class EnService {
  constructor(
    @InjectRepository(EnEntry)
    private readonly enEntriesRep: Repository<EnEntry>,

    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    private readonly enShortTranslationService: EnShortTranslationService,
    private readonly enMeaningService: EnMeaningService,
  ) {}

  async checkWord(word: string, partOfSpeech: EnPartOfSpeechE, forPhrasal: boolean): Promise<number | false> {
    const qb = this.enWordsRep
      .createQueryBuilder('e')
      .innerJoin('e.word', 'w')
      .where('w.word = :word', { word })
      .andWhere('e.part_of_speech = :partOfSpeech', { partOfSpeech });

    if (forPhrasal) {
      qb.leftJoin('e.base_phrasal', 'bp')
        .andWhere('(e.verb___is_phrasal IS NULL OR e.verb___is_phrasal = false)')
        .andWhere('bp.id IS NULL');
    }

    const result = await qb.select('e.id', 'id').getRawOne<{ id: number }>();

    return result?.id ?? false;
  }

  private async addEntry(word: string, type: EnEntryTypesE): Promise<EnEntry> {
    return this.enEntriesRep.save({ word, type });
  }
  private async addWordRow(entry: EnEntry, data: EnWordT): Promise<EnWord> {
    const row = await this.getWordRow(data.word, data.part_of_speech, data.form_of_word);
    if (row) {
      throw new ConflictException(ErrorCodes.word_already_exists);
    }
    const {
      word: _word,
      base_form: _baseForm,
      short_translations: _shortTranslations,
      meanings: _meanings,
      forms: _forms,
      phrasal_variants: _phrasalVariants,
      id: _id,
      base_phrasal,
      ...other
    } = data;
    let basePhrasalWord: EnWord | null | undefined;
    if (other.part_of_speech === EnPartOfSpeechE.verb && base_phrasal) {
      basePhrasalWord = await this.getWordRow(base_phrasal, EnPartOfSpeechE.verb, EnWordFormsE.base_form);
      if (!basePhrasalWord) {
        if (!entry.entries || entry.entries.length === 0) {
          await this.enEntriesRep.delete({ word: entry.word });
        }
        throw new BadRequestException(ErrorCodes.phrasal_base_doesnt_exist);
      }
    }
    return this.enWordsRep.save({
      word: entry,
      ...other,
      ...(basePhrasalWord && { base_phrasal: basePhrasalWord }),
    });
  }

  private async getWordRow(
    word: string,
    pos: EnPartOfSpeechE,
    formOfWord: EnWordFormsE,
  ): Promise<EnWord | null> {
    return this.enWordsRep
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .where('entry.word = :word', { word })
      .andWhere('w.part_of_speech = :pos', { pos })
      .andWhere('w.form_of_word = :formOfWord', { formOfWord })
      .getOne();
  }
  private async getOrAddEntry(word: string, type: EnEntryTypesE): Promise<EnEntry> {
    const entry = await this.enEntriesRep.findOne({ where: { word }, relations: { entries: true } });
    if (entry) {
      return entry;
    }
    return this.addEntry(word, type);
  }

  private async addFormOfWord(wordForm: EnWordFormT, baseWord: EnWord) {
    const { id: _id, word, ...f } = wordForm;
    const formEntry = await this.getOrAddEntry(word, EnEntryTypesE.word);
    const wordRow = await this.getWordRow(word, baseWord.part_of_speech, f.form_of_word);
    if (wordRow) {
      return wordRow;
    } else {
      return this.enWordsRep.save({
        word: formEntry,
        ...f,
        part_of_speech: baseWord.part_of_speech,
        base_form: baseWord,
      });
    }
  }

  async addWord(body: EnWordT): Promise<AddResT> {
    let type = EnEntryTypesE.word;
    if (body.part_of_speech === EnPartOfSpeechE.phrase) {
      type = EnEntryTypesE.phrase;
    }
    if (body.part_of_speech === EnPartOfSpeechE.grammar_pattern) {
      type = EnEntryTypesE.grammar_pattern;
    }
    const baseEntry = await this.getOrAddEntry(body.word, type);
    const baseWord = await this.addWordRow(baseEntry, body);

    if (body.forms) {
      for (const form of body.forms) await this.addFormOfWord(form, baseWord);
    }

    if (body.meanings) {
      for (const m of body.meanings)
        await this.enMeaningService.addMeaning({
          word_id: baseWord.id,
          meaning_level: m.meaning_level,
          language_register: m.language_register,
          categories: m.categories,
          ...m,
        });
    }

    if (body.short_translations) {
      for (const s of body.short_translations)
        await this.enShortTranslationService.addShortTranslation({
          language: s.language,
          description: s.description,
          variant_of_words: s.variants_of_words,
          word_id: baseWord.id,
        });
    }

    return body;
  }

  async search({ search }: SearchReqDTO): Promise<EnWordT[]> {
    const res = await this.enEntriesRep.find({
      where: { word: Like(`%${search}%`) },
      relations: {
        entries: {
          forms: {
            base_form: {
              base_phrasal: { word: true },
              phrasal_variants: true,
              forms: true,
              word: true,
            },
            word: true,
          },
          phrasal_variants: true,
          base_phrasal: { word: true },
          word: true,
        },
      },
    });

    return mapSearchResults(res);
  }

  async deleteWord(id: number): Promise<DeleteResT> {
    const word = await this.enWordsRep.findOne({
      where: { id },
      relations: { word: true, forms: { word: true } },
    });
    if (!word) {
      return { success: false };
    }
    const formEntries: string[] = word.forms.map((f) => f.word.word);
    formEntries.push(word.word.word);
    await this.enWordsRep.delete({ id });

    for (const entryStr of formEntries) {
      const entry = await this.enEntriesRep.findOne({ where: { word: entryStr } });
      if (entry) {
        await this.enEntriesRep.delete({ word: entryStr });
      }
    }
    return { success: true };
  }

  async editWord(id: number, body: EditCommonInfoOfWordReqDTO): Promise<EditCommonInfoOfWordResT> {
    const word = await this.enWordsRep.findOne({ where: { id } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const {
      verb___transitivity,
      verb___is_irregular,
      noun___irregular_plural,
      noun___always_plural,
      noun___uncountable,
      verb___is_phrasal,
      verb___phrasal_object_pattern,
      noun___is_proper,
      language_register,
      categories,
      is_obsolete,
      description,
      generated_by_model,
      generated,
      word_level,
      transcription,
      is_abbreviation,
      area_variant,
      pattern,
    } = body;

    if (typeof generated === 'boolean' && generated !== word.generated) word.generated = generated;
    if (typeof is_obsolete === 'boolean' && is_obsolete !== word.is_obsolete) word.is_obsolete = is_obsolete;
    if (typeof verb___is_irregular === 'boolean' && verb___is_irregular !== word.verb___is_irregular)
      word.verb___is_irregular = verb___is_irregular;
    if (
      typeof noun___irregular_plural === 'boolean' &&
      noun___irregular_plural !== word.noun___irregular_plural
    )
      word.noun___irregular_plural = noun___irregular_plural;
    if (typeof noun___always_plural === 'boolean' && noun___always_plural !== word.noun___always_plural)
      word.noun___always_plural = noun___always_plural;
    if (typeof noun___uncountable === 'boolean' && noun___uncountable !== word.noun___uncountable)
      word.noun___uncountable = noun___uncountable;
    if (typeof noun___is_proper === 'boolean' && noun___is_proper !== word.noun___is_proper)
      word.noun___is_proper = noun___is_proper;
    if (typeof verb___is_phrasal === 'boolean' && verb___is_phrasal !== word.verb___is_phrasal)
      word.verb___is_phrasal = verb___is_phrasal;
    if (typeof is_abbreviation === 'boolean' && is_abbreviation !== word.is_abbreviation)
      word.is_abbreviation = is_abbreviation;
    if (generated_by_model && generated_by_model !== word.generated_by_model)
      word.generated_by_model = generated_by_model;
    if (description && description !== word.description) word.description = description;
    if (verb___phrasal_object_pattern && verb___phrasal_object_pattern !== word.verb___phrasal_object_pattern)
      word.verb___phrasal_object_pattern = verb___phrasal_object_pattern;
    if (verb___transitivity && verb___transitivity !== word.verb___transitivity)
      word.verb___transitivity = verb___transitivity;
    if (transcription && transcription !== word.transcription) word.transcription = transcription;
    if (word_level && word_level !== word.word_level) word.word_level = word_level;
    if (language_register && language_register !== word.language_register)
      word.language_register = language_register;
    if (area_variant && area_variant !== word.area_variant) word.area_variant = area_variant;
    if (categories && categories.join() !== word.categories?.join()) word.categories = categories;
    if (pattern && pattern.join() !== word.pattern?.join()) word.pattern = pattern;

    await this.enWordsRep.save(word);
    return { success: true };
  }

  async editPhrasalBase(body: EditPhrasalBaseReqDTO): Promise<EditPhrasalBaseResT> {
    const word = await this.enWordsRep.findOne({ where: { id: body.id } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const phrasalBase = await this.enWordsRep.findOne({ where: { id: body.phrasal_base_id } });

    if (!phrasalBase) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    word.base_phrasal = phrasalBase;
    await this.enWordsRep.save(word);
    return { success: true };
  }

  async getWordById(id: number): Promise<EnWordT> {
    const res = await this.enWordsRep.findOne({
      where: { id },
      relations: {
        forms: { word: true },
        meanings: { translations: true },
        phrasal_variants: true,
        base_phrasal: { word: true },
        short_translations: true,
        word: true,
      },
    });

    if (!res) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    return prepareWordFromDB(res);
  }

  async addWordForm(body: AddWordFormReqDTO): Promise<AddWordFormResT> {
    const word = await this.enWordsRep
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .where('entry.word = :word', { word: body.word })
      .andWhere('w.form_of_word = :formOfWord', { formOfWord: body.form_of_word })
      .leftJoin('w.base_form', 'baseForm')
      .andWhere('baseForm.id = :baseFormId', { baseFormId: body.base_word_id })
      .getOne();
    if (word) {
      throw new ConflictException(ErrorCodes.word_already_exists);
    }

    // TODO объединить с getById
    const baseWord = await this.enWordsRep.findOne({ where: { id: body.base_word_id } });
    if (!baseWord) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    const entry = await this.getOrAddEntry(body.word, EnEntryTypesE.word);
    const res = await this.enWordsRep.save({
      word: entry,
      form_of_word: body.form_of_word,
      area_variant: body.area_variant,
      base_form: baseWord,
      part_of_speech: baseWord.part_of_speech,
      transcription: body.transcription,
    });

    return { success: true, id: res.id };
  }

  async editWordForm(body: EditWordFormReqDTO): Promise<EditWordFormResT> {
    const word = await this.enWordsRep.findOne({
      where: { id: body.id },
      relations: { word: true },
    });
    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    if (body.word && body.word !== word.word.word) {
      const newEntry = await this.getOrAddEntry(body.word, EnEntryTypesE.word);
      const oldWord = word.word.word;
      word.word = newEntry;
      await this.enWordsRep.save(word);

      const oldEntryWordsCount = await this.enWordsRep
        .createQueryBuilder('w')
        .where('w.word = :word', { word: oldWord })
        .getCount();

      if (oldEntryWordsCount === 0) {
        await this.enEntriesRep.delete({ word: oldWord });
      }
    }

    if (body.transcription && body.transcription !== word.transcription) {
      word.transcription = body.transcription;
    }
    if (body.area_variant && body.area_variant !== word.area_variant) {
      word.area_variant = body.area_variant;
    }

    await this.enWordsRep.save(word);

    return { success: true };
  }
}
