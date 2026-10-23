import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';
import { checkIsPostgres } from '../../../../configuration';
import { MAX_EMBEDDING_DIMENSIONS } from '../../../core/embeddings/profile';

/** An immutable model + preprocessing identity, local to one dataset. */
@Entity('en_embedding_profiles')
@Check(
  'CHK_EN_EMBEDDING_PROFILE_ID',
  checkIsPostgres() ? `"id" ~ '^[a-f0-9]{64}$'` : `length("id") = 64 AND "id" NOT GLOB '*[^a-f0-9]*'`,
)
@Unique('UQ_EN_EMBEDDING_PROFILE_DIMENSIONS', ['id', 'dimensions'])
@Check('CHK_EN_EMBEDDING_PROFILE_DIMENSIONS', `"dimensions" BETWEEN 1 AND ${MAX_EMBEDDING_DIMENSIONS}`)
@Check('CHK_EN_EMBEDDING_PROFILE_NORMALIZATION', `"normalization" = 'l2'`)
export class EnEmbeddingProfile {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 256 })
  model!: string;

  @Column({ type: 'varchar', length: 256 })
  revision!: string;

  @Column({ type: 'integer' })
  dimensions!: number;

  @Column({ type: 'varchar', length: 8 })
  normalization!: 'l2';

  @Column({ type: 'varchar', length: 256 })
  document_format!: string;

  @Column({ type: 'varchar', length: 256 })
  query_format!: string;
}
