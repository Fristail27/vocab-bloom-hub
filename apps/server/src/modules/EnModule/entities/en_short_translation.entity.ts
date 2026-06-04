import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnWord } from './en_word.entity';
import { IsDate, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { AvailableTranslationLanguagesE } from '../../../../types';

@Entity('en_short_translations')
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

  @Column({ type: 'simple-array', array: true, default: [] })
  variantsOfWords!: string[];
}
