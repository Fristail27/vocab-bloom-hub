import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { EnEntry } from './entities/en_entry.entity';
import { EnWord } from './entities/en_word.entity';
import { EnMeaning } from './entities/en_meaning.entity';
import { EnMeaningTranslation } from './entities/en_meaning_translation.entity';
import { EnShortTranslation } from './entities/en_short_translation.entity';
import {
  AddResT,
  DeleteResT,
  EnEntryTypesE,
  EnMeaningT,
  EnMeaningTranslationT,
  EnPartOfSpeechE,
  EnShortTranslationT,
  EnWordFormsE,
  EnWordFormT,
  EnWordT,
} from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { mapSearchResults } from './utils/mapSearchResults';

@Injectable()
export class EnService {
  constructor(
    @InjectRepository(EnEntry)
    private readonly enEntriesRep: Repository<EnEntry>,

    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    @InjectRepository(EnMeaningTranslation)
    private readonly enMeaningTranslationRep: Repository<EnMeaningTranslation>,

    @InjectRepository(EnShortTranslation)
    private readonly enShortTranslationRep: Repository<EnShortTranslation>,
  ) {}

  async checkWord(word: string, partOfSpeech: EnPartOfSpeechE): Promise<boolean> {
    return await this.enWordsRep
      .createQueryBuilder('e')
      .innerJoin('e.word', 'w')
      .where('w.word = :word', { word })
      .andWhere('e.part_of_speech = :partOfSpeech', { partOfSpeech })
      .getExists();
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
      base_phrasal: _basePhrasal,
      short_translations: _shortTranslations,
      meanings: _meanings,
      forms: _forms,
      phrasal_variants: _phrasalVariants,
      id: _id,
      ...other
    } = data;
    return this.enWordsRep.save({ word: entry, ...other });
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
    const entry = await this.enEntriesRep.findOne({ where: { word } });
    if (entry) {
      return entry;
    }
    return this.addEntry(word, type);
  }

  private async addMeaningTranslation(
    m: EnMeaning,
    translation: EnMeaningTranslationT,
  ): Promise<EnMeaningTranslation> {
    const { id: _id, ...t } = translation;
    return this.enMeaningTranslationRep.save({ ...t, meaning: m });
  }

  private async addMeaning(word: EnWord, meaning: EnMeaningT): Promise<EnMeaning> {
    const { translations: _translations, id: _id, ...m } = meaning;
    const newMeaning = await this.enMeaningsRep.save({ ...m, word });

    if (_translations) {
      for (const translation of _translations) {
        await this.addMeaningTranslation(newMeaning, translation);
      }
    }

    return newMeaning;
  }

  private async addShortTranslation(
    word: EnWord,
    shortTranslation: EnShortTranslationT,
  ): Promise<EnShortTranslation> {
    const { id: _id, ...s } = shortTranslation;
    return this.enShortTranslationRep.save({ ...s, word });
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
    const baseEntry = await this.getOrAddEntry(body.word, EnEntryTypesE.word);
    const baseWord = await this.addWordRow(baseEntry, body);

    if (body.forms) {
      for (const form of body.forms) await this.addFormOfWord(form, baseWord);
    }

    if (body.meanings) {
      for (const m of body.meanings) await this.addMeaning(baseWord, m);
    }

    if (body.short_translations) {
      for (const s of body.short_translations) await this.addShortTranslation(baseWord, s);
    }

    // TODO add phrasal_base
    return body;
  }

  async search({ search }: SearchReqDTO): Promise<EnWordT[]> {
    const res = await this.enEntriesRep.find({
      where: { word: Like(`%${search}%`) },
      relations: {
        entries: {
          forms: {
            base_form: {
              forms: true,
              word: true,
            },
            word: true,
          },
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
}
