import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { checkIsPostgres } from '../../../../configuration';
import { EnEmbeddingProfile } from './en_embedding_profile.entity';
import { EnMeaning } from './en_meaning.entity';

/**
 * Imported derived data. real[] keeps storage/transfer independent of extension
 * installation; pgvector searches/indexes cast it to vector(dimensions). SQLite
 * retains the same payload as JSON, without claiming vector search support.
 */
@Entity('en_meaning_embeddings')
@Check(
  'CHK_EN_MEANING_EMBEDDING_HASH',
  checkIsPostgres()
    ? `"input_hash" ~ '^[a-f0-9]{64}$'`
    : `length("input_hash") = 64 AND "input_hash" NOT GLOB '*[^a-f0-9]*'`,
)
@Check(
  'CHK_EN_MEANING_EMBEDDING_VECTOR',
  checkIsPostgres()
    ? `
  array_ndims("embedding") = 1 AND array_lower("embedding", 1) = 1
  AND cardinality("embedding") = "dimensions"
  AND array_position("embedding", NULL) IS NULL
  AND array_position("embedding", 'NaN'::real) IS NULL
  AND array_position("embedding", 'Infinity'::real) IS NULL
  AND array_position("embedding", '-Infinity'::real) IS NULL
`
    : `json_valid("embedding") AND json_type("embedding") = 'array' AND json_array_length("embedding") = "dimensions"`,
)
@Index('IDX_EN_MEANING_EMBEDDINGS_MEANING', ['meaning_id'])
export class EnMeaningEmbedding {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  profile_id!: string;

  @PrimaryColumn({ type: 'integer' })
  meaning_id!: number;

  @Column({ type: 'integer' })
  dimensions!: number;

  @ManyToOne(() => EnEmbeddingProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'profile_id', referencedColumnName: 'id' },
    { name: 'dimensions', referencedColumnName: 'dimensions' },
  ])
  profile!: EnEmbeddingProfile;

  @ManyToOne(() => EnMeaning, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meaning_id' })
  meaning!: EnMeaning;

  @Column({ type: 'varchar', length: 64 })
  input_hash!: string;

  @Column({ type: checkIsPostgres() ? 'real' : 'simple-json', array: checkIsPostgres() })
  embedding!: number[];
}
