import {
  Column,
  CreateDateColumn,
  Entity,
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

  @ManyToOne(() => EnWord, (entry) => entry.meanings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'word_entry_id' })
  word_entry!: EnWord;

  @Column({ type: 'simple-enum', enum: CategoryE, nullable: true })
  category?: CategoryE | null;

  @Column({ type: 'simple-enum', enum: WordLevelE, nullable: true })
  meaning_level?: WordLevelE | null;

  @Column({ type: 'simple-enum', enum: EnAreaVariantsE, nullable: true })
  area_variant?: EnAreaVariantsE | null;

  @Column({ type: 'simple-enum', enum: LanguageRegisterE, nullable: true })
  language_register?: LanguageRegisterE | null;

  @Column({ type: 'int' })
  sort_order!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  definition!: string;

  @Column('text', { array: true, nullable: true })
  examples!: string[];

  @OneToMany(() => EnMeaningTranslation, (entry) => entry.meaning)
  translation!: EnMeaningTranslation[];
}
