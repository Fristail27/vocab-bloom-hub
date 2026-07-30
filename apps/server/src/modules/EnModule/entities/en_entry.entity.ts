import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { IsDate } from 'class-validator';
import { EnWord } from './en_word.entity';
import { EnEntryTypesE } from '../../../../types';
import { checkIsPostgres } from '../../../../configuration';

@Entity('en_entries')
@Index('IDX_EN_ENTRY_TYPE', ['type'])
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
