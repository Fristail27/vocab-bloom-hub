import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, In, Repository } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { SearchDetailedReqDTO } from './dto/SearchDetailedReq.dto';
import { EnEntryTypesE, EnSearchWordT, SearchDetailedItemsT } from '../../../../../types';
import { mapSearchResults } from './utils/mapSearchResults';
import { mapDetailedSearchResults } from './utils/mapDetailedSearchResults';
import { escapeLike } from './utils/escapeLike';

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
      .where("entry.word LIKE :word ESCAPE '\\'", { word: `${escapeLike(search)}%` })
      .andWhere('entry.type NOT IN (:...excludedTypes)', {
        excludedTypes: [EnEntryTypesE.phrase, EnEntryTypesE.grammar_pattern],
      });

    if (excludedIds.length > 0) {
      qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds }).andWhere(
        '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
        { excludedIds },
      );
    }

    const wordsStartFrom = await qb.take(limit).getMany();

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
      const wordsEndsFrom = await qb.take(limit).getMany();

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

      const anyMatchesWords = await qb.take(limit).getMany();

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
          `(entry.word LIKE :start ESCAPE '\\' OR entry.word LIKE :middle ESCAPE '\\' OR entry.word LIKE :end ESCAPE '\\')`,
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
      const phrasesExact = await qb.take(limit).getMany();

      phrasesExact.forEach((w) => phrasesExactSet.add(w.id));
    }
    return phrasesExactSet;
  }

  /**
   * Runs every tier in relevance order (exact, phrasal, starts-with, phrases,
   * ends-with, any) and returns up to `target` word ids in that order.
   */
  private async collectOrderedIds(
    search: string,
    type: EnEntryTypesE | undefined,
    target: number,
  ): Promise<number[]> {
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

    return ordered;
  }

  private async findWordsByIdsOrdered(
    ids: number[],
    relations: FindOptionsRelations<EnWord>,
  ): Promise<EnWord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.enWordsRep.find({ where: { id: In(ids) }, relations });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is EnWord => row !== undefined);
  }

  async search({ search: s, type, limit }: SearchReqDTO): Promise<EnSearchWordT[]> {
    const search = s.trim().toLowerCase();
    const ids = await this.collectOrderedIds(search, type, limit);
    const words = await this.findWordsByIdsOrdered(ids, { word: true, forms: { word: true } });
    return mapSearchResults(words);
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
    const ids = await this.collectOrderedIds(search, type, page * limit + 1);
    const pageIds = ids.slice((page - 1) * limit, page * limit);

    const relations: FindOptionsRelations<EnWord> = { word: true, forms: { word: true } };
    if (with_meanings) {
      relations.meanings = { translations: true, synonyms: true };
    }
    if (with_translations) {
      relations.short_translations = true;
    }

    const words = await this.findWordsByIdsOrdered(pageIds, relations);
    return {
      items: mapDetailedSearchResults(words, { with_meanings, with_translations, translation_languages }),
      page,
      limit,
      has_more: ids.length > page * limit,
    };
  }
}
