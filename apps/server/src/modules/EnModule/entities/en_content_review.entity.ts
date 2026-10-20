import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ReviewScopeE } from '../../../../types/reviews';

/** Local editorial notes. Never exported, copied to a fork, or recorded as content edits.
 * Portable nested identity survives reconciliation's delete/reinsert; a row ID does not.
 * Removed targets are not listed. Retaining their snapshot lets an exact revert restore a check.
 */
@Entity('en_content_reviews')
export class EnContentReview {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  scope!: ReviewScopeE;

  @PrimaryColumn({ type: 'varchar', length: 36 })
  identity!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column()
  checked_at!: Date;
}
