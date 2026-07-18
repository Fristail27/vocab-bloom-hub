import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { IsDate } from 'class-validator';
import { EnWord } from './en_word.entity';
import { EnEntryTypesE } from '../../../../types';

@Entity('en_entries')
@Index('IDX_EN_ENTRY_TYPE', ['type'])
export class EnEntry {
  //TODO сделать условным для sqlite/postgress
  @CreateDateColumn()
  @IsDate()
  createdAt!: Date;

  //TODO сделать условным для sqlite/postgress
  @UpdateDateColumn()
  @IsDate()
  updateAt!: Date;

  @PrimaryColumn({ type: 'varchar', length: 128, unique: true })
  word!: string;

  @Column({ type: 'simple-enum', enum: EnEntryTypesE, default: EnEntryTypesE.word })
  type?: EnEntryTypesE;

  @OneToMany(() => EnWord, (entry) => entry.word, { onDelete: 'CASCADE' })
  entries!: EnWord[];
}
