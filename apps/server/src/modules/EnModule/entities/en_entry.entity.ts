import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { IsDate } from 'class-validator';
import { EnWord } from './en_word.entity';
import { EnEntryTypesE } from '../../../../types';

@Entity('en_entries')
export class EnEntry {
  @CreateDateColumn({ type: 'datetime' })
  @IsDate()
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  @IsDate()
  updateAt!: Date;

  @PrimaryColumn({ type: 'varchar', length: 128, unique: true })
  word!: string;

  @Column({ type: 'simple-enum', enum: EnEntryTypesE, default: EnEntryTypesE.word })
  type?: EnEntryTypesE;

  @OneToMany(() => EnWord, (entry) => entry.word)
  entries!: EnWord[];
}
