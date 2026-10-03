import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { checkIsPostgres } from '../../../../configuration';

const timestamp = (): 'timestamptz' | 'datetime' => (checkIsPostgres() ? 'timestamptz' : 'datetime');

/**
 * The registry of the instance's dictionary datasets (issue #527): one row
 * per dataset with the schema its tables live in and the terms of its data.
 * A row marked `own` is a dataset of the instance's own (issue #540), whose
 * terms are the ones its owner stated.
 * Operational data of this instance, in `public` with the settings — never
 * part of an export.
 */
@Entity('datasets')
export class Dataset {
  @Column({ type: timestamp(), nullable: true })
  terms_updated_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  origins!: import('../../../../types/provenance').OriginT[] | null;

  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: timestamp() })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 40, unique: true })
  name!: string;

  // the Postgres schema of the dataset's tables; `public` for the default one
  @Column({ type: 'varchar', length: 63, unique: true })
  schema!: string;

  @Column({ type: 'varchar', length: 64 })
  source!: string;

  // the name for a reader (issue #540): the catalog's for a dataset of the
  // catalog, the owner's for a dataset of the instance's own
  @Column({ type: 'varchar', length: 120, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 8, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  version!: string | null;

  @Column({ type: 'varchar', length: 64 })
  license!: string;

  @Column({ type: 'text' })
  license_url!: string;

  @Column({ type: 'text' })
  attribution!: string;

  @Column({ type: 'text', nullable: true })
  attribution_url!: string | null;

  @Column({ type: 'text', nullable: true })
  notice!: string | null;

  // the text of a license of the owner's own, in full (issue #540); the
  // notices of a source of the catalog come from the catalog
  @Column({ type: 'text', nullable: true })
  license_text!: string | null;

  // created by the admin (issue #540): its terms are the owner's, whatever the
  // catalog of a later version calls a dataset of the same name
  @Column({ type: 'boolean', default: false })
  own!: boolean;

  @Column({ type: timestamp(), nullable: true })
  imported_at!: Date | null;

  // when the dataset last became the active one: a switch is a change of
  // everything the public API serves, so it counts into Last-Modified
  @Column({ type: timestamp(), nullable: true })
  activated_at!: Date | null;
}
