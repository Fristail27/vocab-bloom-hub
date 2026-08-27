import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, In, Repository } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { SearchDetailedReqDTO } from './dto/SearchDetailedReq.dto';
import { EnEntryTypesE, EnSearchWordT, SearchDetailedItemsT, SearchItemsT } from '../../../../../types';
import { checkIsPostgres } from '../../../../../configuration';
import { mapSearchResults } from './utils/mapSearchResults';
import { mapDetailedSearchResults } from './utils/mapDetailedSearchResults';
import { escapeLike } from './utils/escapeLike';
import { bytewise } from '../../utils/bytewise';
import { RELATION_LOAD_STRATEGY } from '../../utils/wordRelations';

@Injectable()
export class EnSearchService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,
  ) {}

  private async getExactMatchesAndPhrasalVerbsIds(search: string) {
    const exactSet = new Set<number>();
    const phrasalSet = new Set<number>();
    const exactMatch = await this.enWordsRep
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .leftJoinAndSelect('w.base_form', 'baseForm')
      .leftJoinAndSelect('baseForm.base_phrasal', 'baseFormBasePhrasal')
      .leftJoinAndSelect('baseForm.phrasal_variants', 'baseFormPhrasalVariants')
      .leftJoinAndSelect('w.base_phrasal', 'basePhrasal')
      .leftJoinAndSelect('w.phrasal_variants', 'phrasalVariants')
      .where('entry.word = :word', { word: search })
      .getMany();

    exactMatch?.forEach((w) => {
      if (w.base_form) {
        exactSet.add(w.base_form.id);
        if (w.base_form.phrasal_variants) {
          w.base_form.phrasal_variants.forEach((p) => phrasalSet.add(p.id));
        }
      } else {
        exactSet.add(w.id);
        if (w.phrasal_variants) {
          w.phrasal_variants.forEach((p) => phrasalSet.add(p.id));
        }
      }
    });

    return { exactSet, phrasalSet };
  }

  private async getWordsStartsFromSearch(search: string, excludedIds: number[], limit: number) {
    const wordsStartFromSet = new Set<number>();
    if (limit <= 0) {
      return wordsStartFromSet;
    }

    const qb = this.enWordsRep
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.word', 'entry')
      .leftJoinAndSelect('w.base_form', 'baseForm')
      .where(`${bytewise('entry.word')} LIKE :word ESCAPE '\\'`, { word: `${escapeLike(search)}%` })
      .andWhere('entry.type NOT IN (:...excludedTypes)', {
        excludedTypes: [EnEntryTypesE.phrase, EnEntryTypesE.grammar_pattern],
      });

    if (excludedIds.length > 0) {
      qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds }).andWhere(
        '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
        { excludedIds },
      );
    }

    const wordsStartFrom = await qb.limit(limit).getMany();

    wordsStartFrom.forEach((w) => {
      if (w.base_form) {
        wordsStartFromSet.add(w.base_form.id);
      } else {
        wordsStartFromSet.add(w.id);
      }
    });

    return wordsStartFromSet;
  }

  private async getWordsEndsFromSearch(
    search: string,
    type: EnEntryTypesE | undefined,
    excludedIds: number[],
    limit: number,
  ) {
    const wordsEndsFromSet = new Set<number>();

    if ((!type || type === EnEntryTypesE.word) && limit > 0) {
      const qb = this.enWordsRep
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.word', 'entry')
        .leftJoinAndSelect('w.base_form', 'baseForm')
        .where("entry.word LIKE :word ESCAPE '\\'", { word: `%${escapeLike(search)}` })
        .andWhere('entry.type NOT IN (:...excludedTypes)', {
          excludedTypes: [EnEntryTypesE.phrase, EnEntryTypesE.grammar_pattern],
        });

      if (excludedIds.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds }).andWhere(
          '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
          { excludedIds },
        );
      }
      const wordsEndsFrom = await qb.limit(limit).getMany();

      wordsEndsFrom.forEach((w) => wordsEndsFromSet.add(w.id));
    }

    return wordsEndsFromSet;
  }

  private async getAnyMatchesWords(
    search: string,
    type: EnEntryTypesE | undefined,
    excludedIds: number[],
    limit: number,
  ) {
    const anyMatchesWordsSet = new Set<number>();
    if (limit > 0) {
      const includedTypes = type
        ? [type]
        : [EnEntryTypesE.grammar_pattern, EnEntryTypesE.phrase, EnEntryTypesE.word];

      const qb = this.enWordsRep
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.word', 'entry')
        .leftJoinAndSelect('w.base_form', 'baseForm')
        .where("entry.word LIKE :word ESCAPE '\\'", { word: `%${escapeLike(search)}%` })
        .andWhere('entry.type IN (:...includedTypes)', { includedTypes });

      if (excludedIds.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds }).andWhere(
          '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
          { excludedIds },
        );
      }

      const anyMatchesWords = await qb.limit(limit).getMany();

      anyMatchesWords.forEach((w) => anyMatchesWordsSet.add(w.id));
    }

    return anyMatchesWordsSet;
  }

  private async getPhrases(
    search: string,
    type: EnEntryTypesE | undefined,
    excludedIds: number[],
    limit: number,
  ) {
    const phrasesExactSet = new Set<number>();

    if ((!type || type === EnEntryTypesE.phrase || type === EnEntryTypesE.grammar_pattern) && limit > 0) {
      const includedTypes = [];
      if (type === EnEntryTypesE.phrase) includedTypes.push(EnEntryTypesE.phrase);
      if (type === EnEntryTypesE.grammar_pattern) includedTypes.push(EnEntryTypesE.grammar_pattern);
      if (!type) {
        includedTypes.push(EnEntryTypesE.phrase);
        includedTypes.push(EnEntryTypesE.grammar_pattern);
      }

      const qb = this.enWordsRep
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.word', 'entry')
        .where(
          `(${bytewise('entry.word')} LIKE :start ESCAPE '\\' OR entry.word LIKE :middle ESCAPE '\\' OR entry.word LIKE :end ESCAPE '\\')`,
          {
            start: `${escapeLike(search)} %`,
            middle: `% ${escapeLike(search)} %`,
            end: `% ${escapeLike(search)}`,
          },
        )
        .andWhere('entry.type NOT IN (:...excludedTypes)', { excludedTypes: [EnEntryTypesE.word] });

      if (excludedIds.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds });
      }
      const phrasesExact = await qb.limit(limit).getMany();

      phrasesExact.forEach((w) => phrasesExactSet.add(w.id));
    }
    return phrasesExactSet;
  }

  /**
   * The fuzzy tier (issue #278, Postgres only): headwords whose trigrams are
   * similar enough to the term (`%`, pg_trgm.similarity_threshold, 0.3 by
   * default), best match first, served by the GIN index IDX_EN_ENTRY_WORD_TRGM.
   * Inflected forms resolve to their base entry like in the other tiers.
   * Returns the similarity per word id.
   */
  private async getFuzzyMatches(
    search: string,
    type: EnEntryTypesE | undefined,
    limit: number,
  ): Promise<Map<number, number>> {
    const matches = new Map<number, number>();
    if (!checkIsPostgres() || limit <= 0) return matches;

    const includedTypes = type
      ? [type]
      : [EnEntryTypesE.grammar_pattern, EnEntryTypesE.phrase, EnEntryTypesE.word];
    const rows = await this.enWordsRep
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .leftJoin('w.base_form', 'baseForm')
      .select('COALESCE(baseForm.id, w.id)', 'id')
      .addSelect('similarity(entry.word, :search)', 'similarity')
      .where('entry.word % :search', { search })
      .andWhere('entry.type IN (:...includedTypes)', { includedTypes })
      .orderBy('similarity', 'DESC')
      .addOrderBy('entry.word', 'ASC')
      // several forms may resolve to one base entry; over-fetch, then dedupe
      .limit(limit * 3)
      .getRawMany<{ id: unknown; similarity: unknown }>();
    for (const row of rows) {
      const id = Number(row.id);
      if (!matches.has(id)) matches.set(id, Number(Number(row.similarity).toFixed(3)));
      if (matches.size >= limit) break;
    }
    return matches;
  }

  /**
   * Runs every tier in relevance order (exact, phrasal, starts-with, phrases,
   * ends-with, any) and returns up to `target` word ids in that order. When
   * none of them matches, the fuzzy tier answers instead (`similarity` per
   * id, `fuzzy: true`).
   */
  private async collectOrderedIds(
    search: string,
    type: EnEntryTypesE | undefined,
    target: number,
  ): Promise<{ ids: number[]; similarity: Map<number, number>; fuzzy: boolean }> {
    const ordered: number[] = [];
    const pushUpToTarget = (set: Set<number>) => {
      for (const id of set) {
        if (ordered.length >= target) return;
        ordered.push(id);
      }
    };

    const { exactSet, phrasalSet } = await this.getExactMatchesAndPhrasalVerbsIds(search);
    pushUpToTarget(exactSet);
    pushUpToTarget(phrasalSet);
    // exact/phrasal ids beyond the target still must not resurface in lower tiers
    let excludedIds = [...exactSet, ...phrasalSet];

    const wordsStartFromSet =
      !type || type === EnEntryTypesE.word
        ? await this.getWordsStartsFromSearch(search, excludedIds, target - ordered.length)
        : new Set<number>();
    pushUpToTarget(wordsStartFromSet);
    excludedIds = [...excludedIds, ...wordsStartFromSet];

    const phrasesExactSet = await this.getPhrases(search, type, excludedIds, target - ordered.length);
    pushUpToTarget(phrasesExactSet);
    excludedIds = [...excludedIds, ...phrasesExactSet];

    const wordsEndsFromSet = await this.getWordsEndsFromSearch(
      search,
      type,
      excludedIds,
      target - ordered.length,
    );
    pushUpToTarget(wordsEndsFromSet);
    excludedIds = [...excludedIds, ...wordsEndsFromSet];

    const anyMatchesWordsSet = await this.getAnyMatchesWords(
      search,
      type,
      excludedIds,
      target - ordered.length,
    );
    pushUpToTarget(anyMatchesWordsSet);

    if (ordered.length === 0) {
      const similarity = await this.getFuzzyMatches(search, type, target);
      return { ids: [...similarity.keys()], similarity, fuzzy: similarity.size > 0 };
    }
    return { ids: ordered, similarity: new Map(), fuzzy: false };
  }

  private async findWordsByIdsOrdered(
    ids: number[],
    relations: FindOptionsRelations<EnWord>,
  ): Promise<EnWord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.enWordsRep.find({
      where: { id: In(ids) },
      relations,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is EnWord => row !== undefined);
  }

  async searchFlat({ search: s, type, limit }: SearchReqDTO): Promise<SearchItemsT> {
    const search = s.trim().toLowerCase();
    const { ids, similarity, fuzzy } = await this.collectOrderedIds(search, type, limit);
    const words = await this.findWordsByIdsOrdered(ids, { word: true, forms: { word: true } });
    return { items: mapSearchResults(words, similarity), fuzzy };
  }

  async search(body: SearchReqDTO): Promise<EnSearchWordT[]> {
    return (await this.searchFlat(body)).items;
  }

  async searchDetailed({
    search: s,
    type,
    limit = 10,
    page = 1,
    with_meanings = false,
    with_translations = false,
    translation_languages,
  }: SearchDetailedReqDTO): Promise<SearchDetailedItemsT> {
    const search = s.trim().toLowerCase();
    // one id past the requested page tells whether the next page exists
    const { ids, similarity, fuzzy } = await this.collectOrderedIds(search, type, page * limit + 1);
    const pageIds = ids.slice((page - 1) * limit, page * limit);

    const relations: FindOptionsRelations<EnWord> = { word: true, forms: { word: true } };
    if (with_meanings) {
      relations.meanings = { translations: true, synonyms: true, antonyms: true };
    }
    if (with_translations) {
      relations.short_translations = true;
    }

    const words = await this.findWordsByIdsOrdered(pageIds, relations);
    return {
      items: mapDetailedSearchResults(words, {
        with_meanings,
        with_translations,
        translation_languages,
        similarity,
      }),
      page,
      limit,
      has_more: ids.length > page * limit,
      fuzzy,
    };
  }
}
