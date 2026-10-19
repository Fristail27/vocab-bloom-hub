import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import {
  AvailableTranslationLanguagesE,
  EN_STATISTICS_ISSUE_KEYS,
  EnIssueRecordsT,
  EnIssueRecordsQueryT,
  EnIssuesStatisticsT,
  EnPartOfSpeechE,
  EnStatisticsT,
  EnTranslationsStatisticsT,
  EnWordFormsE,
  WordLevelE,
} from '../../../../../types';
import { currentDataset, scoped } from '../../../../core/utils/dataset-scope';

import { issueQuery } from './issue-query';
import { issueInterpretation } from '../../../../../core/constants/statistics';

const NON_WORD_TYPES = [EnPartOfSpeechE.phrase, EnPartOfSpeechE.grammar_pattern];

@Injectable()
export class EnStatisticsService {
  constructor(
    @InjectRepository(EnEntry)
    private readonly activeEnEntriesRep: Repository<EnEntry>,

    @InjectRepository(EnWord)
    private readonly activeEnWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly activeEnMeaningsRep: Repository<EnMeaning>,

    @InjectRepository(EnMeaningTranslation)
    private readonly activeEnMeaningTranslationsRep: Repository<EnMeaningTranslation>,

    @InjectRepository(EnShortTranslation)
    private readonly activeEnShortTranslationsRep: Repository<EnShortTranslation>,
  ) {}

  // the dataset the request works on (issue #540): the active one, or the
  // one the switch of the admin UI names
  private get enEntriesRep(): Repository<EnEntry> {
    return scoped(this.activeEnEntriesRep);
  }

  private get enWordsRep(): Repository<EnWord> {
    return scoped(this.activeEnWordsRep);
  }

  private get enMeaningsRep(): Repository<EnMeaning> {
    return scoped(this.activeEnMeaningsRep);
  }

  private get enMeaningTranslationsRep(): Repository<EnMeaningTranslation> {
    return scoped(this.activeEnMeaningTranslationsRep);
  }

  private get enShortTranslationsRep(): Repository<EnShortTranslation> {
    return scoped(this.activeEnShortTranslationsRep);
  }

  // "Words" baseline: base forms excluding phrases and grammar patterns
  private get baseWordsWhere() {
    return {
      form_of_word: EnWordFormsE.base_form,
      part_of_speech: Not(In(NON_WORD_TYPES)),
    };
  }

  private baseWordsQb(alias = 'w') {
    return this.enWordsRep
      .createQueryBuilder(alias)
      .where(`${alias}.form_of_word = :baseForm`, { baseForm: EnWordFormsE.base_form })
      .andWhere(`${alias}.part_of_speech NOT IN (:...nonWordTypes)`, { nonWordTypes: NON_WORD_TYPES });
  }

  private async countDistinctWordsWithRelation(relation: 'meanings' | 'short_translations'): Promise<number> {
    const res = await this.baseWordsQb()
      .innerJoin(`w.${relation}`, 'rel')
      .select('COUNT(DISTINCT w.id)', 'count')
      .getRawOne<{ count: string }>();

    return Number(res?.count ?? 0);
  }

  async getStatistics(): Promise<EnStatisticsT> {
    const [
      entries,
      words,
      phrases,
      grammarPatterns,
      wordForms,
      meanings,
      meaningTranslations,
      shortTranslations,
      generatedWords,
      obsoleteWords,
      phrasalVerbs,
      wordsWithMeanings,
      wordsWithShortTranslations,
      byPosRaw,
      byLevelRaw,
    ] = await Promise.all([
      this.enEntriesRep.count(),
      this.enWordsRep.count({ where: this.baseWordsWhere }),
      this.enWordsRep.count({ where: { part_of_speech: EnPartOfSpeechE.phrase } }),
      this.enWordsRep.count({ where: { part_of_speech: EnPartOfSpeechE.grammar_pattern } }),
      this.enWordsRep.count({ where: { form_of_word: Not(EnWordFormsE.base_form) } }),
      this.enMeaningsRep.count(),
      this.enMeaningTranslationsRep.count(),
      this.enShortTranslationsRep.count(),
      this.enWordsRep.count({ where: { ...this.baseWordsWhere, generated: true } }),
      this.enWordsRep.count({ where: { ...this.baseWordsWhere, is_obsolete: true } }),
      this.enWordsRep.createQueryBuilder('w').innerJoin('w.base_phrasal', 'bp').getCount(),
      this.countDistinctWordsWithRelation('meanings'),
      this.countDistinctWordsWithRelation('short_translations'),
      this.enWordsRep
        .createQueryBuilder('w')
        .select('w.part_of_speech', 'part_of_speech')
        .addSelect('COUNT(*)', 'count')
        .where('w.form_of_word = :baseForm', { baseForm: EnWordFormsE.base_form })
        .groupBy('w.part_of_speech')
        .orderBy('count', 'DESC')
        .getRawMany<{ part_of_speech: EnPartOfSpeechE; count: string }>(),
      this.baseWordsQb()
        .select('w.word_level', 'word_level')
        .addSelect('COUNT(*)', 'count')
        .groupBy('w.word_level')
        .getRawMany<{ word_level: WordLevelE | null; count: string }>(),
    ]);

    return {
      totals: {
        entries,
        words,
        phrases,
        grammar_patterns: grammarPatterns,
        word_forms: wordForms,
        meanings,
        meaning_translations: meaningTranslations,
        short_translations: shortTranslations,
      },
      coverage: {
        words_with_meanings: wordsWithMeanings,
        words_with_short_translations: wordsWithShortTranslations,
        generated_words: generatedWords,
        obsolete_words: obsoleteWords,
        phrasal_verbs: phrasalVerbs,
      },
      by_part_of_speech: byPosRaw.map((r) => ({ part_of_speech: r.part_of_speech, count: Number(r.count) })),
      by_word_level: byLevelRaw.map((r) => ({ word_level: r.word_level ?? null, count: Number(r.count) })),
    };
  }

  async getTranslationsStatistics(): Promise<EnTranslationsStatisticsT> {
    const [
      words,
      meanings,
      meaningTranslations,
      shortTranslations,
      meaningsWithoutTranslations,
      meaningTranslationsByLanguage,
      shortTranslationsByLanguage,
      meaningsByLevelRaw,
    ] = await Promise.all([
      this.enWordsRep.count({ where: this.baseWordsWhere }),
      this.enMeaningsRep.count(),
      this.enMeaningTranslationsRep.count(),
      this.enShortTranslationsRep.count(),
      this.enMeaningsRep
        .createQueryBuilder('m')
        .leftJoin('m.translations', 't')
        .where('t.id IS NULL')
        .getCount(),
      this.enMeaningTranslationsRep
        .createQueryBuilder('t')
        .select('t.language', 'language')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.language')
        .getRawMany<{ language: AvailableTranslationLanguagesE; count: string }>(),
      this.enShortTranslationsRep
        .createQueryBuilder('t')
        .select('t.language', 'language')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.language')
        .getRawMany<{ language: AvailableTranslationLanguagesE; count: string }>(),
      this.enMeaningsRep
        .createQueryBuilder('m')
        .select('m.meaning_level', 'meaning_level')
        .addSelect('COUNT(*)', 'count')
        .groupBy('m.meaning_level')
        .getRawMany<{ meaning_level: WordLevelE | null; count: string }>(),
    ]);

    const languages = new Map<AvailableTranslationLanguagesE, { meaning: number; short: number }>();
    for (const r of meaningTranslationsByLanguage) {
      languages.set(r.language, { meaning: Number(r.count), short: 0 });
    }
    for (const r of shortTranslationsByLanguage) {
      const entry = languages.get(r.language) ?? { meaning: 0, short: 0 };
      entry.short = Number(r.count);
      languages.set(r.language, entry);
    }

    return {
      totals: {
        meanings,
        meaning_translations: meaningTranslations,
        short_translations: shortTranslations,
        meanings_without_translations: meaningsWithoutTranslations,
        avg_meanings_per_word: words > 0 ? Number((meanings / words).toFixed(2)) : 0,
      },
      by_language: [...languages.entries()].map(([language, counts]) => ({
        language,
        meaning_translations: counts.meaning,
        short_translations: counts.short,
      })),
      meanings_by_level: meaningsByLevelRaw.map((r) => ({
        meaning_level: r.meaning_level ?? null,
        count: Number(r.count),
      })),
    };
  }

  async getIssuesStatistics(): Promise<EnIssuesStatisticsT> {
    const [words, meanings, meaningTranslations, shortTranslations] = await Promise.all([
      this.enWordsRep.count({ where: this.baseWordsWhere }),
      this.enMeaningsRep.count(),
      this.enMeaningTranslationsRep.count(),
      this.enShortTranslationsRep.count(),
    ]);

    const dataset = currentDataset();
    const totals = {
      word: words,
      meaning: meanings,
      meaning_translation: meaningTranslations,
      short_translation: shortTranslations,
    };
    const issues = await Promise.all(
      EN_STATISTICS_ISSUE_KEYS.map(async (key) => {
        const { qb, kind } = issueQuery(this.enWordsRep.manager, key);
        return {
          key,
          kind,
          count: await qb.getCount(),
          total: totals[kind],
          interpretation: issueInterpretation(key, dataset),
        };
      }),
    );
    return { dataset: dataset.name, issues };
  }

  async getIssueRecords({ category, page = 1, limit = 25 }: EnIssueRecordsQueryT): Promise<EnIssueRecordsT> {
    const dataset = currentDataset();
    const { qb, kind } = issueQuery(this.enWordsRep.manager, category);
    const total = await qb.getCount();
    // After fixing the last record on a page, return the last existing page.
    page = Math.min(page, Math.max(1, Math.ceil(total / limit)));
    const word = kind === 'word' ? 'r' : 'w';
    const meaning = kind === 'meaning' ? 'r' : kind === 'meaning_translation' ? 'm' : null;
    const translated = kind === 'meaning_translation' || kind === 'short_translation';
    const items = await qb
      .select('r.id', 'id')
      .addSelect(`${word}.id`, 'word_id')
      .addSelect(`${word}.word`, 'word')
      .addSelect(`${word}.part_of_speech`, 'part_of_speech')
      .addSelect(meaning ? `${meaning}.id` : 'NULL', 'meaning_id')
      .addSelect(meaning ? `${meaning}.title` : 'NULL', 'meaning_title')
      .addSelect(meaning ? `${meaning}.definition` : 'NULL', 'meaning_definition')
      .addSelect(translated ? 'r.language' : 'NULL', 'language')
      .addSelect(
        kind === 'meaning_translation'
          ? 'r.definition'
          : kind === 'short_translation'
            ? 'r.description'
            : 'NULL',
        'text',
      )
      .orderBy('r.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<EnIssueRecordsT['items'][number]>();
    return {
      dataset: dataset.name,
      category,
      kind,
      interpretation: issueInterpretation(category, dataset),
      items,
      total,
      page,
      limit,
    };
  }
}
