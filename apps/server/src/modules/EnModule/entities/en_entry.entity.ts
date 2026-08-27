import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { IndexOptions } from 'typeorm';
import { IsDate } from 'class-validator';
import { EnWord } from './en_word.entity';
import { EnEntryTypesE } from '../../../../types';
import { checkIsPostgres } from '../../../../configuration';

// `synchronize: false` keeps schema sync and migration:generate away from an
// index (they neither create nor drop it); TypeORM reads it at runtime
// (IndexMetadataArgs.synchronize) but leaves it out of the decorator's typing
const MANUALLY_MANAGED_INDEX = { synchronize: false } as IndexOptions;

@Entity('en_entries')
@Index('IDX_EN_ENTRY_TYPE', ['type'])
// Byte-order index behind the public list's (word, id) ordering and cursor
// (issue #272): created by the AddEntryWordCollateCIndex migration with
// COLLATE "C", which the decorator cannot express — hence synchronize: false.
// SQLite orders text bytewise anyway and needs nothing extra
@Index('IDX_EN_ENTRY_WORD_C', ['word'], MANUALLY_MANAGED_INDEX)
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

  @OneToMany(() => EnWord, (entry) => entry.word, { onDelete: 'CASCADE' })
  entries!: EnWord[];
}
