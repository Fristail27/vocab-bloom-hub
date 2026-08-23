import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AddMeaningResT, DeleteMeaningResT, EditMeaningResT } from '../../../../../types';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { AddMeaningReqDTO } from './dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from './dto/EditMeaningReq.dto';
import { EnWord } from '../../entities/en_word.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnMeaningTranslationService } from '../EnMeaningTranslation/enMeaningTranslation.service';
import { normalizeSynonyms } from '../../utils/normalizeSynonyms';
import { loadEntries, resolveBaseFormHeadwords } from '../../utils/findBaseFormHeadwords';

@Injectable()
export class EnMeaningService {
  private readonly logger = new Logger(EnMeaningService.name);

  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    private readonly enMeaningTranslationService: EnMeaningTranslationService,
  ) {}

  /**
   * Turns a synonym list into links to existing dictionary entries. The list is
   * normalized first (trimmed, lowercase, unique, without the headword); every
   * remaining word must name the headword of a base-form entry (inflected forms
   * like "ran" do not qualify) — directly or through a spelling variant such as
   * "absent-minded" for "absentminded" — otherwise the request is rejected: a
   * synonym is a reference to a word, not free text. The stored link always
   * uses the dictionary spelling.
   */
  async resolveSynonymEntries(
    synonyms: readonly string[] | null | undefined,
    headword: string,
    manager?: EntityManager,
  ): Promise<EnEntry[]> {
    const em = manager ?? this.enMeaningsRep.manager;
    const words = normalizeSynonyms(synonyms, headword);
    if (words.length === 0) return [];

    const resolved = await resolveBaseFormHeadwords(em, words);
    const missing = words.filter((w) => !resolved.has(w));
    if (missing.length > 0) {
      this.logger.warn(`Synonyms not found as base-form words for "${headword}": ${missing.join(', ')}`);
      throw new BadRequestException(ErrorCodes.synonym_doesnt_exist);
    }
    // dictionary spellings, deduplicated (two variants may name one word) and
    // without the headword itself, in a stable order
    const headwords = normalizeSynonyms(
      words.map((w) => resolved.get(w) as string),
      headword,
    );
    return loadEntries(em, headwords);
  }

  async addMeaning(body: AddMeaningReqDTO, manager?: EntityManager): Promise<AddMeaningResT> {
    const em = manager ?? this.enMeaningsRep.manager;
    const { word_id, id: _id, synonyms, ...newMeaning } = body;
    const word = await em.getRepository(EnWord).findOne({ where: { id: word_id }, relations: { word: true } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const synonymEntries = await this.resolveSynonymEntries(synonyms, word.word.word, em);
    const res = await em.getRepository(EnMeaning).save({ word: word, ...newMeaning, synonyms: synonymEntries });
    if (body.translations.length > 0) {
      for (const translation of body.translations) {
        await this.enMeaningTranslationService.addMeaningTranslation(
          {
            meaning_id: res.id,
            ...translation,
          },
          manager,
        );
      }
    }

    this.logger.log(`Meaning added to word id=${word_id}, id=${res.id}`);

    return { success: true, id: res.id };
  }

  async editMeaning(body: EditMeaningReqDTO): Promise<EditMeaningResT> {
    const meaning = await this.enMeaningsRep.findOne({
      where: { id: body.id },
      relations: { synonyms: true, word: { word: true } },
    });

    if (!meaning) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    if (body.title && body.title !== meaning.title) meaning.title = body.title;
    if (body.definition && body.definition !== meaning.definition) meaning.definition = body.definition;
    if (body.sort_order && body.sort_order !== meaning.sort_order) meaning.sort_order = body.sort_order;
    if (body.meaning_level && body.meaning_level !== meaning.meaning_level)
      meaning.meaning_level = body.meaning_level;
    if (body.language_register !== meaning.language_register)
      meaning.language_register = body.language_register;
    if (body.area_variant && body.area_variant !== meaning.area_variant)
      meaning.area_variant = body.area_variant;
    // examples is a nullable column: rows imported without examples hold NULL
    if (body.examples && body.examples.join() !== meaning.examples?.join()) meaning.examples = body.examples;
    if (body.categories && body.categories.join() !== meaning.categories?.join())
      meaning.categories = body.categories;
    // synonyms replace the whole set; TypeORM diffs the junction rows on save
    if (body.synonyms) {
      const current = normalizeSynonyms(meaning.synonyms.map((e) => e.word));
      const next = normalizeSynonyms(body.synonyms, meaning.word.word.word);
      if (current.join() !== next.join()) {
        meaning.synonyms = await this.resolveSynonymEntries(next, meaning.word.word.word);
      }
    }

    await this.enMeaningsRep.save(meaning);
    this.logger.log(`Meaning updated, id=${body.id}`);
    return { success: true };
  }

  async deleteMeaning(id: number): Promise<DeleteMeaningResT> {
    await this.enMeaningsRep.delete({ id });

    this.logger.log(`Meaning deleted, id=${id}`);

    return { success: true };
  }
}
