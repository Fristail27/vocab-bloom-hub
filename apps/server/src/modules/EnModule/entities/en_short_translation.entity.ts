import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnWord } from './en_word.entity';
import { IsDate, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { AvailableTranslationLanguagesE } from '../../../../types';

@Entity('en_short_translations')
@Index('IDX_EN_SHORT_TRANSLATION_WORD', ['word'])
@Index('IDX_EN_SHORT_TRANSLATION_LANGUAGE', ['language'])
export class EnShortTranslation {
  @PrimaryGeneratedColumn()
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  id!: number;

  @CreateDateColumn()
  @IsDate()
  createdAt!: Date;

  @UpdateDateColumn()
  @IsDate()
  updateAt!: Date;

  @Column({ type: 'text' })
  description!: string;

  @ManyToOne(() => EnWord, (entry) => entry.short_translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word' })
  word!: EnWord;

  @Column({ type: 'simple-enum', enum: AvailableTranslationLanguagesE })
  language!: AvailableTranslationLanguagesE.ru;

  //TODO сделать условным для sqlite/postgress
  @Column({ type: 'text', array: true, default: [] })
  variants_of_words!: string[];
}
