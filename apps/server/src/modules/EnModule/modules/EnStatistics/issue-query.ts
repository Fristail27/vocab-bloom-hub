import { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { EnIssueKindT, EnPartOfSpeechE, EnStatisticsIssueKeyT, EnWordFormsE } from '../../../../../types';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';

/** One root row per affected record. Counts and pages share every predicate. */
export function issueQuery(
  manager: EntityManager,
  key: EnStatisticsIssueKeyT,
): {
  qb: SelectQueryBuilder<ObjectLiteral>;
  kind: EnIssueKindT;
} {
  if (key.startsWith('words_')) {
    const qb = manager
      .createQueryBuilder(EnWord, 'r')
      .where('r.form_of_word = :base', { base: EnWordFormsE.base_form })
      .andWhere('r.part_of_speech NOT IN (:...excluded)', {
        excluded: [EnPartOfSpeechE.phrase, EnPartOfSpeechE.grammar_pattern],
      });
    switch (key) {
      case 'words_without_meanings':
        qb.leftJoin('r.meanings', 'missing').andWhere('missing.id IS NULL');
        break;
      case 'words_without_short_translations':
        qb.leftJoin('r.short_translations', 'missing').andWhere('missing.id IS NULL');
        break;
      case 'words_without_level':
        qb.andWhere('r.word_level IS NULL');
        break;
      case 'words_without_transcription':
        qb.andWhere("(r.transcription IS NULL OR TRIM(r.transcription) = '')");
        break;
      case 'words_without_description':
        qb.andWhere("(r.description IS NULL OR TRIM(r.description) = '')");
        break;
    }
    return { qb, kind: 'word' };
  }
  if (key.startsWith('meanings_')) {
    const qb = manager.createQueryBuilder(EnMeaning, 'r').innerJoin('r.word', 'w');
    switch (key) {
      case 'meanings_without_translations':
        qb.leftJoin('r.translations', 'missing').where('missing.id IS NULL');
        break;
      case 'meanings_without_examples':
        qb.where('r.examples IS NULL OR CAST(r.examples AS TEXT) IN (:...empty)', { empty: ['', '{}'] });
        break;
      case 'meanings_without_synonyms':
        qb.leftJoin('r.synonyms', 'missing').where('missing.word IS NULL');
        break;
      case 'meanings_without_antonyms':
        qb.leftJoin('r.antonyms', 'missing').where('missing.word IS NULL');
        break;
    }
    return { qb, kind: 'meaning' };
  }
  if (key === 'empty_meaning_translations') {
    return {
      qb: manager
        .createQueryBuilder(EnMeaningTranslation, 'r')
        .innerJoin('r.meaning', 'm')
        .innerJoin('m.word', 'w')
        .where("TRIM(r.title) = '' OR TRIM(r.definition) = ''"),
      kind: 'meaning_translation',
    };
  }
  return {
    qb: manager
      .createQueryBuilder(EnShortTranslation, 'r')
      .innerJoin('r.word', 'w')
      .where("TRIM(r.description) = ''"),
    kind: 'short_translation',
  };
}
