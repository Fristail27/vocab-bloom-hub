import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { EnEntryTypesE, EnWordT } from '../../../../../types';
import { mapSearchResults } from './utils/mapSearchResults';
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
      const includedTypes = [EnEntryTypesE.grammar_pattern, EnEntryTypesE.phrase, EnEntryTypesE.word];
      if (type) {
        includedTypes.filter((t) => t === type);
      }

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

  async search({ search: s, type, limit }: SearchReqDTO): Promise<EnWordT[]> {
    const search = s.trim().toLowerCase();
    let excludedIds: number[] = [];
    const { exactSet, phrasalSet } = await this.getExactMatchesAndPhrasalVerbsIds(search);

    excludedIds = [...excludedIds, ...exactSet, ...phrasalSet];

    const wordsStartFromLimit = limit - exactSet.size - phrasalSet.size;
    const wordsStartFromSet =
      !type || type === EnEntryTypesE.word
        ? await this.getWordsStartsFromSearch(search, excludedIds, wordsStartFromLimit)
        : new Set<number>();

    excludedIds = [...excludedIds, ...wordsStartFromSet];
    const phrasesLimit = wordsStartFromLimit - wordsStartFromSet.size;
    const phrasesExactSet = await this.getPhrases(search, type, excludedIds, phrasesLimit);
    excludedIds = [...excludedIds, ...phrasesExactSet];

    // TODO add a check to add other matches

    const resPromises = [];

    if (exactSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...exactSet]) },
          relations: { word: true, forms: { word: true } },
          take: limit,
        }),
      );
    }

    if (limit - exactSet.size > 0 && phrasalSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...phrasalSet]) },
          relations: { word: true, forms: { word: true } },
          take: limit - exactSet.size,
        }),
      );
    }

    if (limit - exactSet.size - phrasalSet.size > 0 && wordsStartFromSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...wordsStartFromSet]) },
          relations: { word: true, forms: { word: true } },
          take: limit - exactSet.size - phrasalSet.size,
        }),
      );
    }

    if (limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size > 0 && phrasesExactSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...phrasesExactSet]) },
          relations: { word: true, forms: { word: true } },
          take: limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size,
        }),
      );
    }
    const wordsEndsFromLimit =
      limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size - phrasesExactSet.size;
    const wordsEndsFromSet = await this.getWordsEndsFromSearch(search, type, excludedIds, wordsEndsFromLimit);
    excludedIds = [...excludedIds, ...wordsEndsFromSet];

    if (wordsEndsFromSet && wordsEndsFromSet?.size > 0) {
      if (wordsEndsFromSet.size > 0) {
        resPromises.push(
          this.enWordsRep.find({
            where: { id: In([...wordsEndsFromSet]) },
            relations: { word: true, forms: { word: true } },
            take: wordsEndsFromLimit,
          }),
        );
      }
    }

    const anyMatchesWordsLimit = wordsEndsFromLimit - wordsEndsFromSet.size;
    const anyMatchesWordsSet = await this.getAnyMatchesWords(search, type, excludedIds, anyMatchesWordsLimit);
    if (anyMatchesWordsSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...anyMatchesWordsSet]) },
          relations: { word: true, forms: { word: true } },
          take: anyMatchesWordsLimit,
        }),
      );
    }
    const res = await Promise.all(resPromises);
    return mapSearchResults(res.flat());
  }
}
