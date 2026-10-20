import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { reviewContent } from '../../../../../core/utils/content_review';
import { ContentReviewT, ReviewScopeE, ReviewStatusE, ReviewWordsT } from '../../../../../types/reviews';
import { scopedManager } from '../../../../core/utils/dataset-scope';
import { EnWord } from '../../entities/en_word.entity';
import { EnContentReview } from '../../entities/en_content_review.entity';
import { reviewEntities, reviewQuery } from './query';
import { ReviewWordsQueryDTO, SetContentReviewDTO } from './dto';
import { foldedWord } from '../../utils/foldedWord';
import { escapeLike } from '../EnSearch/utils/escapeLike';

type ReviewRow = {
  id: number;
  sync_id: string | null;
  content: string;
  status: ReviewStatusE;
  checked_at: Date | string | null;
  word: string;
  part_of_speech: string;
  title: string;
  definition: string;
  language: string;
  description: string;
  variants_of_words: string[] | string;
  meaning_title: string;
  meaning_definition: string;
};

@Injectable()
export class EnReviewService {
  constructor(private readonly dataSource: DataSource) {}
  private get manager() {
    return scopedManager(this.dataSource.manager);
  }

  private rows(em: EntityManager, scope: ReviewScopeE) {
    const { qb, content, status } = reviewQuery(em, scope);
    qb.select('target.id', 'id')
      .addSelect('target.sync_id', 'sync_id')
      .addSelect(content, 'content')
      .addSelect(status, 'status')
      .addSelect('review.checked_at', 'checked_at')
      .addSelect('entry.word', 'word')
      .addSelect('w.part_of_speech', 'part_of_speech');
    const fields =
      scope === ReviewScopeE.definition
        ? ['title', 'definition']
        : scope === ReviewScopeE.meaning_translation
          ? ['title', 'definition', 'language', 'variants_of_words']
          : ['description', 'language', 'variants_of_words'];
    for (const field of fields) qb.addSelect(`target.${field}`, field);
    if (scope === ReviewScopeE.meaning_translation)
      qb.addSelect('m.title', 'meaning_title').addSelect('m.definition', 'meaning_definition');
    return qb;
  }

  private present(scope: ReviewScopeE, row: ReviewRow): ContentReviewT {
    const variants = Array.isArray(row.variants_of_words)
      ? row.variants_of_words
      : row.variants_of_words
        ? row.variants_of_words.split(',')
        : [];
    return {
      scope,
      id: Number(row.id),
      status: row.status,
      checked_at: row.checked_at ? new Date(row.checked_at).toISOString() : null,
      expected: reviewContent(
        scope,
        row,
        { ...row, variants_of_words: variants },
        { title: row.meaning_title, definition: row.meaning_definition },
      ),
    };
  }

  async word(id: number): Promise<ContentReviewT[]> {
    const em = this.manager;
    if (!(await em.existsBy(EnWord, { id }))) throw new NotFoundException(ErrorCodes.word_doesnt_found);
    const result: ContentReviewT[] = [];
    for (const scope of Object.values(ReviewScopeE)) {
      const rows = await this.rows(em, scope).where('w.id = :id', { id }).getRawMany<ReviewRow>();
      result.push(...rows.map((row) => this.present(scope, row)));
    }
    return result;
  }

  async set(scope: ReviewScopeE, id: number, body: SetContentReviewDTO): Promise<ContentReviewT> {
    return this.manager.transaction(async (em) => {
      const query = this.rows(em, scope).where('target.id = :id', { id });
      if (em.connection.options.type === 'postgres')
        query.setLock(
          'pessimistic_write',
          undefined,
          scope === ReviewScopeE.meaning_translation ? ['target', 'm', 'w', 'entry'] : ['target', 'w', 'entry'],
        );
      const row = await query.getRawOne<ReviewRow>();
      if (!row) throw new NotFoundException(ErrorCodes.review_target_not_found);
      const value = this.present(scope, row);
      if (body.checked && body.expected !== value.expected)
        throw new ConflictException(ErrorCodes.review_content_changed);
      if (!body.checked) {
        if (row.sync_id) await em.delete(EnContentReview, { scope, identity: row.sync_id });
        return { ...value, status: ReviewStatusE.unchecked, checked_at: null };
      }
      const identity = row.sync_id ?? randomUUID();
      if (!row.sync_id) {
        // Assign merge identity only. A review is not a content edit and must not stamp updateAt.
        await em
          .createQueryBuilder()
          .update(reviewEntities[scope])
          .set({ sync_id: identity, updateAt: () => '"updateAt"' })
          .where('id = :id', { id })
          .execute();
      }
      const checked_at = new Date();
      await em.upsert(EnContentReview, { scope, identity, content: row.content, checked_at }, [
        'scope',
        'identity',
      ]);
      return { ...value, status: ReviewStatusE.checked, checked_at: checked_at.toISOString() };
    });
  }

  async words(query: ReviewWordsQueryDTO): Promise<ReviewWordsT> {
    const { qb, status } = reviewQuery(this.manager, query.scope);
    const search = query.search?.trim().toLowerCase();
    if (search)
      qb.where(`${foldedWord('entry.word')} LIKE :prefix ESCAPE '\\'`, { prefix: `${escapeLike(search)}%` });
    const counts = { unchecked: 0, checked: 0, changed: 0 };
    const buckets = await qb
      .clone()
      .select(status, 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy(status)
      .getRawMany<{ status: ReviewStatusE; count: string }>();
    for (const bucket of buckets) counts[bucket.status] = Number(bucket.count);
    if (query.status) qb.andWhere(`(${status}) = :status`, { status: query.status });
    const count = await qb.clone().select('COUNT(DISTINCT w.id)', 'total').getRawOne<{ total: string }>();
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const items = await qb
      .select('w.id', 'id')
      .addSelect('entry.word', 'word')
      .addSelect('w.part_of_speech', 'part_of_speech')
      .addSelect('COUNT(*)', 'matches')
      .groupBy('w.id')
      .addGroupBy('entry.word')
      .addGroupBy('w.part_of_speech')
      .orderBy(foldedWord('entry.word'), 'ASC')
      .addOrderBy('w.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<ReviewWordsT['items'][number]>();
    return {
      items: items.map((row) => ({ ...row, id: Number(row.id), matches: Number(row.matches) })),
      total: Number(count?.total ?? 0),
      page,
      limit,
      counts,
    };
  }
}
