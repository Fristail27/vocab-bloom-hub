import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, In, Repository, SelectQueryBuilder } from 'typeorm';
import { EnWord } from '../EnModule/entities/en_word.entity';
import { EnService } from '../EnModule/en.service';
import { FULL_WORD_RELATIONS } from '../EnModule/utils/wordRelations';
import { prepareWordFromDB } from '../EnModule/utils/prepareWordFromDB';
import { mapDetailedSearchResults } from '../EnModule/modules/EnSearch/utils/mapDetailedSearchResults';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { checkIsPostgres } from '../../../configuration';
import {
  AvailableTranslationLanguagesE,
  EnWordFormsE,
  EnWordT,
  PublicHeadwordFormsV1ResT,
  PublicHeadwordMeaningsV1ResT,
  PublicHeadwordTranslationsV1ResT,
  PublicHeadwordV1ResT,
  PublicWordsV1ResT,
} from '../../../types';
import { WordFiltersV1QueryDTO } from './dto/WordFiltersV1Query.dto';
import { ListWordsV1QueryDTO, PUBLIC_LIST_DEFAULT_LIMIT } from './dto/ListWordsV1Query.dto';
import { decodeWordCursor, encodeWordCursor } from './utils/cursor';

/**
 * Read-only dictionary lookups of the public API (issue #272): a headword
 * with all of its entries, an entry by id, the filtered cursor-paged list
 * and a random entry. Everything answers in the shapes of
 * `types/public/v1`, built with the same mappers as the admin reads.
 */
@Injectable()
export class PublicWordsService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,
    private readonly enService: EnService,
  ) {}

  // ------------------------------------------------------------ headword

  /**
   * The base entries a spelling names: a row that is a base form itself, or
   * the base form an inflected row ("ran") belongs to. Ordered by part of
   * speech, then id, so the answer is stable
   */
  private async resolveEntryIds(word: string): Promise<number[]> {
    const rows = await this.enWordsRep
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .leftJoin('w.base_form', 'baseForm')
      .select(['w.id', 'w.part_of_speech'])
      .addSelect(['baseForm.id', 'baseForm.part_of_speech'])
      .where('entry.word = :word', { word })
      .getMany();
    const targets = rows.map((row) => row.base_form ?? row);
    const unique = new Map(targets.map((row) => [row.id, row]));
    return [...unique.values()]
      .sort((a, b) => a.part_of_speech.localeCompare(b.part_of_speech) || a.id - b.id)
      .map((row) => row.id);
  }

  // Relation rows come back in storage order; the public answer sorts them
  // by their natural keys so consumers see one order on every driver
  private sortRelations(row: EnWord): EnWord {
    row.forms?.sort((a, b) => a.id - b.id);
    row.meanings?.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    row.meanings?.forEach((m) => m.translations?.sort((a, b) => a.id - b.id));
    row.short_translations?.sort((a, b) => a.id - b.id);
    return row;
  }

  private async loadFull(ids: number[]): Promise<EnWordT[]> {
    if (ids.length === 0) return [];
    const rows = await this.enWordsRep.find({ where: { id: In(ids) }, relations: FULL_WORD_RELATIONS });
    const byId = new Map(rows.map((row) => [row.id, this.sortRelations(row)]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is EnWord => row !== undefined)
      .map(prepareWordFromDB);
  }

  private normalizeHeadword(raw: string): string {
    return raw.trim().toLowerCase();
  }

  async getByHeadword(raw: string): Promise<PublicHeadwordV1ResT> {
    const word = this.normalizeHeadword(raw);
    const ids = word ? await this.resolveEntryIds(word) : [];
    if (ids.length === 0) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    const data = await this.loadFull(ids);
    return { data, meta: { word, count: data.length } };
  }

  async getMeaningsByHeadword(raw: string): Promise<PublicHeadwordMeaningsV1ResT> {
    const { data: entries, meta } = await this.getByHeadword(raw);
    const data = entries.flatMap((entry) =>
      entry.meanings.map((meaning) => ({
        ...meaning,
        word_id: entry.id,
        part_of_speech: entry.part_of_speech,
      })),
    );
    return { data, meta };
  }

  async getFormsByHeadword(raw: string): Promise<PublicHeadwordFormsV1ResT> {
    const { data: entries, meta } = await this.getByHeadword(raw);
    const data = entries.flatMap((entry) =>
      entry.forms.map((form) => ({ ...form, word_id: entry.id, part_of_speech: entry.part_of_speech })),
    );
    return { data, meta };
  }

  async getTranslationsByHeadword(
    raw: string,
    languages?: AvailableTranslationLanguagesE[],
  ): Promise<PublicHeadwordTranslationsV1ResT> {
    const { data: entries, meta } = await this.getByHeadword(raw);
    const matches = (language: AvailableTranslationLanguagesE) =>
      !languages?.length || languages.includes(language);
    const short_translations = entries.flatMap((entry) =>
      entry.short_translations
        .filter((t) => matches(t.language))
        .map((t) => ({ ...t, word_id: entry.id, part_of_speech: entry.part_of_speech })),
    );
    const meaning_translations = entries.flatMap((entry) =>
      entry.meanings.flatMap((meaning) =>
        meaning.translations
          .filter((t) => matches(t.language))
          .map((t) => ({
            ...t,
            meaning_id: meaning.id,
            word_id: entry.id,
            part_of_speech: entry.part_of_speech,
          })),
      ),
    );
    return { data: { short_translations, meaning_translations }, meta };
  }

  // ------------------------------------------------------------------ id

  async getById(id: number): Promise<EnWordT> {
    return this.enService.getWordById(id);
  }

  // ---------------------------------------------------------------- list

  /** The shared filters as WHERE clauses; values of one filter are OR-ed */
  private applyFilters(qb: SelectQueryBuilder<EnWord>, filters: WordFiltersV1QueryDTO): void {
    const forms = filters.form_of_word?.length ? filters.form_of_word : [EnWordFormsE.base_form];
    qb.andWhere('w.form_of_word IN (:...forms)', { forms });
    if (filters.part_of_speech?.length) {
      qb.andWhere('w.part_of_speech IN (:...partsOfSpeech)', { partsOfSpeech: filters.part_of_speech });
    }
    if (filters.word_level?.length) {
      qb.andWhere('w.word_level IN (:...wordLevels)', { wordLevels: filters.word_level });
    }
    if (filters.language_register?.length) {
      qb.andWhere('w.language_register IN (:...registers)', { registers: filters.language_register });
    }
    if (filters.area_variant?.length) {
      qb.andWhere('w.area_variant IN (:...areaVariants)', { areaVariants: filters.area_variant });
    }
    if (filters.category?.length) {
      // categories is an enum[] on Postgres and a comma-joined text on SQLite
      const clauses = filters.category.map((_, i) =>
        checkIsPostgres()
          ? `:category${i} = ANY(w.categories)`
          : `(',' || w.categories || ',') LIKE ('%,' || :category${i} || ',%')`,
      );
      qb.andWhere(
        `(${clauses.join(' OR ')})`,
        Object.fromEntries(filters.category.map((c, i) => [`category${i}`, c])),
      );
    }
  }

  private filtered(filters: WordFiltersV1QueryDTO): SelectQueryBuilder<EnWord> {
    const qb = this.enWordsRep.createQueryBuilder('w').innerJoin('w.word', 'entry');
    this.applyFilters(qb, filters);
    return qb;
  }

  private async loadPage(ids: number[], query: ListWordsV1QueryDTO): Promise<EnWordT[]> {
    if (ids.length === 0) return [];
    const with_meanings = query.with_meanings ?? false;
    const with_translations = query.with_translations ?? false;
    const relations: FindOptionsRelations<EnWord> = { word: true, forms: { word: true } };
    if (with_meanings) relations.meanings = { translations: true, synonyms: true, antonyms: true };
    if (with_translations) relations.short_translations = true;
    const rows = await this.enWordsRep.find({ where: { id: In(ids) }, relations });
    const byId = new Map(rows.map((row) => [row.id, this.sortRelations(row)]));
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is EnWord => row !== undefined);
    return mapDetailedSearchResults(ordered, { with_meanings, with_translations });
  }

  // The headword compared and ordered by its bytes on every driver: SQLite
  // does that by default, Postgres would otherwise apply the database locale
  // (backed by the IDX_EN_ENTRY_WORD_C index, see the migration of that name)
  private get orderedWord(): string {
    return checkIsPostgres() ? 'entry.word COLLATE "C"' : 'entry.word';
  }

  /**
   * Keyset pagination over (word, id): the page after a cursor is every row
   * that sorts after the cursor's row, so pages never repeat or skip items
   * while the dictionary is edited. One row past the page tells whether a
   * next page exists.
   */
  async listWords(query: ListWordsV1QueryDTO): Promise<PublicWordsV1ResT> {
    const limit = query.limit ?? PUBLIC_LIST_DEFAULT_LIMIT;
    const qb = this.filtered(query).select(['w.id']).addSelect(['entry.word']);
    if (query.cursor !== undefined) {
      const cursor = decodeWordCursor(query.cursor);
      if (!cursor) {
        throw new BadRequestException(ErrorCodes.invalid_cursor);
      }
      qb.andWhere(`(${this.orderedWord} > :cursorWord OR (entry.word = :cursorWord AND w.id > :cursorId))`, {
        cursorWord: cursor.word,
        cursorId: cursor.id,
      });
    }
    // the only join is a many-to-one, so a raw LIMIT is safe (no row multiplication)
    const rows = await qb
      .orderBy(this.orderedWord, 'ASC')
      .addOrderBy('w.id', 'ASC')
      .limit(limit + 1)
      .getMany();
    const has_more = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const data = await this.loadPage(
      page.map((row) => row.id),
      query,
    );
    return {
      data,
      meta: {
        limit,
        has_more,
        next_cursor: has_more && last ? encodeWordCursor({ word: last.word.word, id: last.id }) : null,
      },
    };
  }

  // -------------------------------------------------------------- random

  /**
   * A random entry without `ORDER BY random()`: the id range of the rows
   * matching the filters is read from the primary key, a pivot is drawn in
   * it and the first matching row at or after the pivot is taken — index
   * lookups only. Rows right after a gap in the ids are drawn slightly more
   * often; for a "word of the day" that bias does not matter.
   */
  async getRandom(filters: WordFiltersV1QueryDTO): Promise<EnWordT> {
    const bounds = await this.filtered(filters)
      .select('MIN(w.id)', 'min')
      .addSelect('MAX(w.id)', 'max')
      .getRawOne<{ min: unknown; max: unknown }>();
    if (bounds?.min === null || bounds?.min === undefined) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    const min = Number(bounds.min);
    const max = Number(bounds.max);
    const pivot = min + Math.floor(Math.random() * (max - min + 1));
    const hit = await this.filtered(filters)
      .select('w.id', 'id')
      .andWhere('w.id >= :pivot', { pivot })
      .orderBy('w.id', 'ASC')
      .limit(1)
      .getRawOne<{ id: unknown }>();
    if (hit?.id === null || hit?.id === undefined) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    return this.getById(Number(hit.id));
  }
}
