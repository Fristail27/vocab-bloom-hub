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
import { IsDate, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { EnMeaning } from './en_meaning.entity';
import { AvailableTranslationLanguagesE } from '../../../../types';
import { checkIsPostgres } from '../../../../configuration';

@Entity('en_meanings_translations')
@Index('IDX_EN_MEANING_TRANSLATION_MEANING', ['meaning'])
@Index('IDX_EN_MEANING_TRANSLATION_LANGUAGE', ['language'])
export class EnMeaningTranslation {
  /** @asType integer */
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

  @Column({ type: 'simple-enum', enum: AvailableTranslationLanguagesE })
  language!: AvailableTranslationLanguagesE.ru;

  @ManyToOne(() => EnMeaning, (entry) => entry.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meaning' })
  meaning!: EnMeaning;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  definition!: string;

  @Column({ type: checkIsPostgres() ? 'text' : 'simple-array', array: true, default: [] })
  variants_of_words!: string[];
}
