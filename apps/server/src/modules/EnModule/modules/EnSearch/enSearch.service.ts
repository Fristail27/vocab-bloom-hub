import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { EnEntryTypesE, EnWordT } from '../../../../../types';
import { mapSearchResults } from './utils/mapSearchResults';

@Injectable()
export class EnSearchService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,
  ) {}

  async search({ search: s, type, limit }: SearchReqDTO): Promise<EnWordT[]> {
    const search = s.trim().toLowerCase();
    const exactSet = new Set<number>();
    const phrasalSet = new Set<number>();
    const wordsStartFromSet = new Set<number>();
    const phrasesExactSet = new Set<number>();

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

    const excludedIds = [...exactSet, ...phrasalSet];
    if (!type || type === EnEntryTypesE.word) {
      const qb = this.enWordsRep
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.word', 'entry')
        .leftJoinAndSelect('w.base_form', 'baseForm')
        .where('LOWER(entry.word) LIKE :word', { word: `${search}%` })
        .andWhere('entry.type NOT IN (:...excludedTypes)', {
          excludedTypes: [EnEntryTypesE.phrase, EnEntryTypesE.grammar_pattern],
        });

      if (excludedIds.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds }).andWhere(
          '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
          { excludedIds },
        );
      }

      const wordsStartFrom = await qb.getMany();

      wordsStartFrom.forEach((w) => {
        if (w.base_form) {
          wordsStartFromSet.add(w.base_form.id);
        } else {
          wordsStartFromSet.add(w.id);
        }
      });
    }

    // TODO add a check to add other matches

    const excludedIds2 = [...new Set([...excludedIds, ...wordsStartFromSet])];

    if (!type || type === EnEntryTypesE.phrase || type === EnEntryTypesE.grammar_pattern) {
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
          `(LOWER(entry.word) LIKE :start OR LOWER(entry.word) LIKE :middle OR LOWER(entry.word) LIKE :end)`,
          { start: `${search} %`, middle: `% ${search} %`, end: `% ${search}` },
        );

      if (excludedIds2.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds: excludedIds2 });
      }
      const phrasesExact = await qb.getMany();

      phrasesExact.forEach((w) => phrasesExactSet.add(w.id));
    }

    const resPromises = [];
    if (exactSet.size > 0) {
      resPromises.push(
        this.enWordsRep.find({
          where: { id: In([...exactSet]) },
          relations: { word: true, forms: { word: true } },
          take: limit - exactSet.size,
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
    const wordsEndsFromSet = new Set<number>();
    if (limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size - phrasesExactSet.size > 0) {
      if (!type || type === EnEntryTypesE.word) {
        const excluded = [...exactSet, ...phrasalSet, ...wordsStartFromSet, ...phrasesExactSet];
        const qb = this.enWordsRep
          .createQueryBuilder('w')
          .innerJoinAndSelect('w.word', 'entry')
          .leftJoinAndSelect('w.base_form', 'baseForm')
          .where('LOWER(entry.word) LIKE :word', { word: `%${search}` })
          .andWhere('entry.type NOT IN (:...excludedTypes)', {
            excludedTypes: [EnEntryTypesE.phrase, EnEntryTypesE.grammar_pattern],
          });

        if (excluded.length > 0) {
          qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds: excluded }).andWhere(
            '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
            { excludedIds: excluded },
          );
        }

        const wordsEndsFrom = await qb
          .take(limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size - phrasalSet.size)
          .getMany();

        wordsEndsFrom.forEach((w) => wordsEndsFromSet.add(w.id));

        if (wordsEndsFromSet.size > 0) {
          resPromises.push(
            this.enWordsRep.find({
              where: { id: In([...wordsEndsFromSet]) },
              relations: { word: true, forms: { word: true } },
              take: limit - exactSet.size - phrasalSet.size - wordsStartFromSet.size - phrasesExactSet.size,
            }),
          );
        }
      }
    }

    const anyMatchesWordsSet = new Set<number>();
    if (
      limit -
        exactSet.size -
        phrasalSet.size -
        wordsStartFromSet.size -
        phrasesExactSet.size -
        wordsEndsFromSet.size >
      0
    ) {
      const includedTypes = [EnEntryTypesE.grammar_pattern, EnEntryTypesE.phrase, EnEntryTypesE.word];
      if (type) {
        includedTypes.filter((t) => t === type);
      }

      const excluded = [
        ...exactSet,
        ...phrasalSet,
        ...wordsStartFromSet,
        ...phrasesExactSet,
        ...wordsEndsFromSet,
      ];
      const qb = this.enWordsRep
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.word', 'entry')
        .leftJoinAndSelect('w.base_form', 'baseForm')
        .where('LOWER(entry.word) LIKE :word', { word: `%${search}%` })
        .andWhere('entry.type IN (:...includedTypes)', { includedTypes });

      if (excluded.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludedIds)', { excludedIds: excluded }).andWhere(
          '(baseForm.id IS NULL OR baseForm.id NOT IN (:...excludedIds))',
          { excludedIds: excluded },
        );
      }

      const anyMatchesWords = await qb
        .take(
          limit -
            exactSet.size -
            phrasalSet.size -
            wordsStartFromSet.size -
            phrasesExactSet.size -
            wordsEndsFromSet.size,
        )
        .getMany();

      anyMatchesWords.forEach((w) => anyMatchesWordsSet.add(w.id));

      if (anyMatchesWordsSet.size > 0) {
        resPromises.push(
          this.enWordsRep.find({
            where: { id: In([...anyMatchesWordsSet]) },
            relations: { word: true, forms: { word: true } },
            take:
              limit -
              exactSet.size -
              phrasalSet.size -
              wordsStartFromSet.size -
              phrasalSet.size -
              wordsEndsFromSet.size,
          }),
        );
      }
    }
    const res = await Promise.all(resPromises);
    return mapSearchResults(res.flat());
  }
}
