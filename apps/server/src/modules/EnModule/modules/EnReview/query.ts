import { EntityManager } from 'typeorm';
import { ReviewScopeE } from '../../../../../types/reviews';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { EnContentReview } from '../../entities/en_content_review.entity';

export const reviewEntities = {
  [ReviewScopeE.definition]: EnMeaning,
  [ReviewScopeE.meaning_translation]: EnMeaningTranslation,
  [ReviewScopeE.short_translation]: EnShortTranslation,
};

/** A length-prefixed snapshot compares the actual content in SQL on both supported drivers.
 * Array columns keep their native text representation; the snapshot never crosses databases.
 * No timestamps, release labels, or row IDs participate in content equality.
 */
export function reviewQuery(em: EntityManager, scope: ReviewScopeE) {
  const qb = em.createQueryBuilder().from(reviewEntities[scope], 'target');
  if (scope === ReviewScopeE.meaning_translation) {
    qb.innerJoin('target.meaning', 'm').innerJoin('m.word', 'w');
  } else qb.innerJoin('target.word', 'w');
  qb.innerJoin('w.word', 'entry');
  const fields = [
    'entry.word',
    'w.part_of_speech',
    ...(scope === ReviewScopeE.definition
      ? ['target.title', 'target.definition']
      : scope === ReviewScopeE.meaning_translation
        ? [
            'm.title',
            'm.definition',
            'target.language',
            'target.title',
            'target.definition',
            'target.variants_of_words',
          ]
        : ['target.language', 'target.description', 'target.variants_of_words']),
  ];
  const content = fields
    .map((field) => {
      const text = `COALESCE(CAST(${field} AS TEXT), '')`;
      return `(LENGTH(${text}) || ':' || ${text})`;
    })
    .join(" || '' || ");
  qb.leftJoin(EnContentReview, 'review', 'review.scope = :reviewScope AND review.identity = target.sync_id', {
    reviewScope: scope,
  });
  const status = `CASE WHEN review.identity IS NULL THEN 'unchecked' WHEN review.content = (${content}) THEN 'checked' ELSE 'changed' END`;
  return { qb, content, status };
}
