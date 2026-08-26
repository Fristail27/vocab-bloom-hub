import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import {
  EnMeaningListItemT,
  EnMeaningsListT,
  EnMeaningTranslationListItemT,
  EnMeaningTranslationsListT,
  EnWordListItemT,
  EnWordsListT,
  EnWordFormsE,
  PaginatedListT,
} from '../../../../../types';
import { ListWordsQueryDTO } from './dto/ListWordsQuery.dto';
import { ListMeaningsQueryDTO } from './dto/ListMeaningsQuery.dto';
import { ListMeaningTranslationsQueryDTO } from './dto/ListMeaningTranslationsQuery.dto';
import { LIST_DEFAULT_LIMIT, PaginationQueryDTO } from './dto/PaginationQuery.dto';
import { escapeLike } from '../EnSearch/utils/escapeLike';
import { normalizeWordLinks } from '../../utils/normalizeWordLinks';

type PageT = { page: number; limit: number };
type WordLinksT = { synonyms: string[]; antonyms: string[] };
const EMPTY_LINKS: WordLinksT = { synonyms: [], antonyms: [] };

// COUNT comes back as a string on Postgres (bigint) and as a number on SQLite
const toCount = (value: unknown): number => Number(value) || 0;

/**
 * Paginated admin listings behind the bulk-request page: base-form words,
 * meanings and meaning translations, each filterable by its own columns and
 * ordered by word → part of speech → id so pages stay stable while a run walks
 * through them.
 */
@Injectable()
export class EnAdminListsService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,
    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,
    @InjectRepository(EnMeaningTranslation)
    private readonly enMeaningTranslationsRep: Repository<EnMeaningTranslation>,
  ) {}

  private pageOf(query: PaginationQueryDTO): PageT {
    return { page: query.page ?? 1, limit: query.limit ?? LIST_DEFAULT_LIMIT };
  }

  private paginated<T>(items: T[], { page, limit }: PageT, total: number): PaginatedListT<T> {
    return { items, page, limit, total, has_more: page * limit < total };
  }

  /** Filters shared by every listing: word prefix and part of speech of the owning word */
  private applyWordFilters<T extends object>(
    qb: SelectQueryBuilder<T>,
    query: { search?: string; part_of_speech?: string[] },
  ): void {
    const search = query.search?.trim().toLowerCase();
    if (search) {
      qb.andWhere("entry.word LIKE :prefix ESCAPE '\\'", { prefix: `${escapeLike(search)}%` });
    }
    if (query.part_of_speech?.length) {
      qb.andWhere('w.part_of_speech IN (:...partsOfSpeech)', { partsOfSpeech: query.part_of_speech });
    }
  }

  // ---------------------------------------------------------------- words

  private applyWordsListFilters(qb: SelectQueryBuilder<EnWord>, query: ListWordsQueryDTO): void {
    this.applyWordFilters(qb, query);
    if (query.area_variant?.length) {
      qb.andWhere('w.area_variant IN (:...areaVariants)', { areaVariants: query.area_variant });
    }
    if (query.word_level?.length) {
      qb.andWhere('w.word_level IN (:...wordLevels)', { wordLevels: query.word_level });
    }
    if (query.language_register?.length) {
      qb.andWhere('w.language_register IN (:...registers)', { registers: query.language_register });
    }
    if (query.generated_by_model !== undefined) {
      qb.andWhere('w.generated_by_model = :model', { model: query.generated_by_model });
    }
    if (query.version !== undefined) {
      qb.andWhere('w.version = :version', { version: query.version });
    }
    // Boolean columns go through the object form so every driver binds them
    // with its own boolean representation (1/0 on SQLite, true/false on Postgres)
    if (query.generated !== undefined) {
      qb.andWhere({ generated: query.generated });
    }
    if (query.is_obsolete !== undefined) {
      qb.andWhere({ is_obsolete: query.is_obsolete });
    }
    if (query.has_meanings !== undefined) {
      const meanings = qb.subQuery().select('1').from(EnMeaning, 'm').where('m.word = w.id').getQuery();
      qb.andWhere(`${query.has_meanings ? '' : 'NOT '}EXISTS ${meanings}`);
    }
    if (query.has_short_translations !== undefined) {
      const translations = qb
        .subQuery()
        .select('1')
        .from(EnShortTranslation, 'st')
        .where('st.word = w.id')
        .getQuery();
      qb.andWhere(`${query.has_short_translations ? '' : 'NOT '}EXISTS ${translations}`);
    }
  }

  private mapWord(row: EnWord, counts: { meanings: number; short_translations: number }): EnWordListItemT {
    return {
      id: row.id,
      word: row.word.word,
      part_of_speech: row.part_of_speech,
      area_variant: row.area_variant ?? null,
      word_level: row.word_level ?? null,
      language_register: row.language_register ?? null,
      generated: Boolean(row.generated),
      generated_by_model: row.generated_by_model ?? null,
      version: row.version,
      is_obsolete: Boolean(row.is_obsolete),
      transcription: row.transcription ?? null,
      description: row.description ?? null,
      categories: row.categories ?? [],
      meanings_count: counts.meanings,
      short_translations_count: counts.short_translations,
    };
  }

  /** Base-form words with their meanings / short translations counters */
  async listWords(query: ListWordsQueryDTO): Promise<EnWordsListT> {
    const page = this.pageOf(query);

    const qb = this.enWordsRep
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.word', 'entry')
      .where('w.form_of_word = :baseForm', { baseForm: EnWordFormsE.base_form });
    this.applyWordsListFilters(qb, query);

    const total = await qb.clone().getCount();

    const meaningsCount = qb
      .subQuery()
      .select('COUNT(*)')
      .from(EnMeaning, 'mc')
      .where('mc.word = w.id')
      .getQuery();
    const shortTranslationsCount = qb
      .subQuery()
      .select('COUNT(*)')
      .from(EnShortTranslation, 'stc')
      .where('stc.word = w.id')
      .getQuery();

    // The only join is a many-to-one, so raw OFFSET/LIMIT is safe here and
    // avoids the distinct-subquery pagination TypeORM uses for skip/take
    const { entities, raw } = await qb
      .addSelect(meaningsCount, 'meanings_count')
      .addSelect(shortTranslationsCount, 'short_translations_count')
      .orderBy('entry.word', 'ASC')
      .addOrderBy('w.part_of_speech', 'ASC')
      .addOrderBy('w.id', 'ASC')
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .getRawAndEntities<{ w_id: number; meanings_count: unknown; short_translations_count: unknown }>();

    const countsById = new Map(
      raw.map((r) => [
        Number(r.w_id),
        { meanings: toCount(r.meanings_count), short_translations: toCount(r.short_translations_count) },
      ]),
    );

    return this.paginated(
      entities.map((row) =>
        this.mapWord(row, countsById.get(row.id) ?? { meanings: 0, short_translations: 0 }),
      ),
      page,
      total,
    );
  }

  // ------------------------------------------------------------- meanings

  private applyMeaningsListFilters(qb: SelectQueryBuilder<EnMeaning>, query: ListMeaningsQueryDTO): void {
    this.applyWordFilters(qb, query);
    if (query.area_variant?.length) {
      qb.andWhere('m.area_variant IN (:...areaVariants)', { areaVariants: query.area_variant });
    }
    if (query.meaning_level?.length) {
      qb.andWhere('m.meaning_level IN (:...meaningLevels)', { meaningLevels: query.meaning_level });
    }
    if (query.language_register?.length) {
      qb.andWhere('m.language_register IN (:...registers)', { registers: query.language_register });
    }
    if (query.is_obsolete !== undefined) {
      qb.andWhere({ is_obsolete: query.is_obsolete });
    }
    if (query.has_translations !== undefined) {
      const translations = qb
        .subQuery()
        .select('1')
        .from(EnMeaningTranslation, 'mt')
        .where('mt.meaning = m.id')
        .getQuery();
      qb.andWhere(`${query.has_translations ? '' : 'NOT '}EXISTS ${translations}`);
    }
  }

  /**
   * Synonyms and antonyms are many-to-many relations: joining them into the
   * paginated query would multiply rows and break OFFSET/LIMIT, so the page's
   * links are loaded with a second query
   */
  private async loadWordLinksByMeaningId(ids: number[]): Promise<Map<number, WordLinksT>> {
    if (ids.length === 0) return new Map();
    const rows = await this.enMeaningsRep.find({
      where: { id: In(ids) },
      relations: { synonyms: true, antonyms: true },
      select: { id: true, synonyms: { word: true }, antonyms: { word: true } },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          synonyms: normalizeWordLinks(r.synonyms.map((e) => e.word)),
          antonyms: normalizeWordLinks(r.antonyms.map((e) => e.word)),
        },
      ]),
    );
  }

  private mapMeaning(row: EnMeaning, translationsCount: number, links: WordLinksT): EnMeaningListItemT {
    return {
      id: row.id,
      word_id: row.word.id,
      word: row.word.word.word,
      part_of_speech: row.word.part_of_speech,
      title: row.title,
      definition: row.definition,
      sort_order: row.sort_order,
      area_variant: row.area_variant,
      meaning_level: row.meaning_level ?? null,
      language_register: row.language_register ?? null,
      categories: row.categories ?? [],
      is_obsolete: Boolean(row.is_obsolete),
      examples: row.examples ?? [],
      synonyms: links.synonyms,
      antonyms: links.antonyms,
      translations_count: translationsCount,
    };
  }

  /** Meanings with the word they belong to and their translations counter */
  async listMeanings(query: ListMeaningsQueryDTO): Promise<EnMeaningsListT> {
    const page = this.pageOf(query);

    const qb = this.enMeaningsRep
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.word', 'w')
      .innerJoinAndSelect('w.word', 'entry');
    this.applyMeaningsListFilters(qb, query);

    const total = await qb.clone().getCount();

    const translationsCount = qb
      .subQuery()
      .select('COUNT(*)')
      .from(EnMeaningTranslation, 'mtc')
      .where('mtc.meaning = m.id')
      .getQuery();

    const { entities, raw } = await qb
      .addSelect(translationsCount, 'translations_count')
      .orderBy('entry.word', 'ASC')
      .addOrderBy('w.part_of_speech', 'ASC')
      .addOrderBy('w.id', 'ASC')
      .addOrderBy('m.sort_order', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .getRawAndEntities<{ m_id: number; translations_count: unknown }>();

    const countsById = new Map(raw.map((r) => [Number(r.m_id), toCount(r.translations_count)]));
    const linksById = await this.loadWordLinksByMeaningId(entities.map((row) => row.id));

    return this.paginated(
      entities.map((row) =>
        this.mapMeaning(row, countsById.get(row.id) ?? 0, linksById.get(row.id) ?? EMPTY_LINKS),
      ),
      page,
      total,
    );
  }

  // ------------------------------------------------------- meaning translations

  private mapMeaningTranslation(row: EnMeaningTranslation): EnMeaningTranslationListItemT {
    return {
      id: row.id,
      meaning_id: row.meaning.id,
      word_id: row.meaning.word.id,
      word: row.meaning.word.word.word,
      part_of_speech: row.meaning.word.part_of_speech,
      meaning_title: row.meaning.title,
      meaning_definition: row.meaning.definition,
      language: row.language,
      title: row.title,
      definition: row.definition,
      variants_of_words: row.variants_of_words ?? [],
    };
  }

  /** Meaning translations with the meaning and the word they belong to */
  async listMeaningTranslations(query: ListMeaningTranslationsQueryDTO): Promise<EnMeaningTranslationsListT> {
    const page = this.pageOf(query);

    const qb = this.enMeaningTranslationsRep
      .createQueryBuilder('tr')
      .innerJoinAndSelect('tr.meaning', 'm')
      .innerJoinAndSelect('m.word', 'w')
      .innerJoinAndSelect('w.word', 'entry');
    this.applyWordFilters(qb, query);
    if (query.language?.length) {
      qb.andWhere('tr.language IN (:...languages)', { languages: query.language });
    }

    const total = await qb.clone().getCount();

    const rows = await qb
      .orderBy('entry.word', 'ASC')
      .addOrderBy('w.part_of_speech', 'ASC')
      .addOrderBy('w.id', 'ASC')
      .addOrderBy('m.sort_order', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .addOrderBy('tr.language', 'ASC')
      .addOrderBy('tr.id', 'ASC')
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .getMany();

    return this.paginated(
      rows.map((row) => this.mapMeaningTranslation(row)),
      page,
      total,
    );
  }
}
