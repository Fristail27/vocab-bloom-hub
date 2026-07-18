import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnWord } from './en_word.entity';
import { IsDate, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { EnMeaningTranslation } from './en_meaning_translation.entity';
import { CategoryE, EnAreaVariantsE, LanguageRegisterE, WordLevelE } from '../../../../types';

@Entity('en_meanings')
@Index('IDX_EN_MEANING_WORD', ['word'])
@Index('IDX_EN_MEANING_WORD_SORT', ['word', 'sort_order'])
export class EnMeaning {
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

  @ManyToOne(() => EnWord, (entry) => entry.meanings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word' })
  word!: EnWord;

  @Column({ type: 'simple-enum', enum: CategoryE, array: true, default: [] })
  categories?: CategoryE[] | null;

  @Column({ type: 'simple-enum', enum: WordLevelE, nullable: true })
  meaning_level?: WordLevelE | null;

  @Column({ type: 'simple-enum', enum: EnAreaVariantsE, default: EnAreaVariantsE.common })
  area_variant!: EnAreaVariantsE;

  @Column({ type: 'simple-enum', enum: LanguageRegisterE, nullable: true })
  language_register?: LanguageRegisterE | null;

  @Column({ type: 'int' })
  sort_order!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  definition!: string;

  @Column({ type: 'boolean', default: false })
  is_obsolete!: boolean;

  //TODO сделать условным для sqlite/postgress
  @Column({ type: 'text', array: true, nullable: true })
  examples!: string[];

  @OneToMany(() => EnMeaningTranslation, (entry) => entry.meaning, { onDelete: 'CASCADE' })
  translations!: EnMeaningTranslation[];
}
