import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MANUALLY_MANAGED_INDEX } from './manually-managed-index';
import { IsDate } from 'class-validator';
import { EnWord } from './en_word.entity';
import { EnEntryTypesE } from '../../../../types';
import { checkIsPostgres } from '../../../../configuration';

@Entity('en_entries')
@Index('IDX_EN_ENTRY_TYPE', ['type'])
// Byte-order index behind the public list's (word, id) ordering and cursor
// (issue #272): created by the AddEntryWordCollateCIndex migration with
// COLLATE "C", which the decorator cannot express — hence synchronize: false.
// SQLite orders text bytewise anyway and needs nothing extra
@Index('IDX_EN_ENTRY_WORD_C', ['word'], MANUALLY_MANAGED_INDEX)
// GIN over the trigrams of the headword (issue #278): the substring search
// tiers and the fuzzy tier; created by the AddEntryWordTrigramIndex
// migration (needs pg_trgm), nothing on SQLite
@Index('IDX_EN_ENTRY_WORD_TRGM', ['word'], MANUALLY_MANAGED_INDEX)
export class EnEntry {
  @CreateDateColumn({ type: checkIsPostgres() ? 'timestamptz' : 'datetime' })
  @IsDate()
  createdAt!: Date;

  @UpdateDateColumn({ type: checkIsPostgres() ? 'timestamptz' : 'datetime' })
  @IsDate()
  updateAt!: Date;

  @PrimaryColumn({ type: 'varchar', length: 128, unique: true })
  word!: string;

  @Column({ type: 'simple-enum', enum: EnEntryTypesE, default: EnEntryTypesE.word })
  type?: EnEntryTypesE;

  // Set by every admin mutation that touches this entry's content (issue
  // #328); a dictionary update keeps flagged entries instead of replacing
  // them with the dataset. Edits to a form row flag the base word's entry —
  // the unit a dataset update replaces.
  @Column({ type: 'boolean', default: false })
  user_modified?: boolean;

  @OneToMany(() => EnWord, (entry) => entry.word, { onDelete: 'CASCADE' })
  entries!: EnWord[];
}
