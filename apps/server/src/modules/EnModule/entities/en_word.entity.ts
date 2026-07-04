import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { IsNumber, IsDate, IsNotEmpty, IsPositive } from 'class-validator';
import { EnEntry } from './en_entry.entity';
import { EnMeaning } from './en_meaning.entity';
import { EnShortTranslation } from './en_short_translation.entity';
import {
  CategoryE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnPhrasalObjectPatternE,
  EnVerbTransitivityE,
  EnWordFormsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../types';

@Entity('en_words')
@Index('IDX_EN_WORD_LOOKUP', ['word', 'part_of_speech', 'form_of_word'])
@Index('IDX_EN_BASE_FORM', ['base_form'])
@Index('IDX_EN_BASE_PHRASAL', ['base_phrasal'])
@Index('IDX_EN_PART_OF_SPEECH', ['part_of_speech'])
export class EnWord {
  @PrimaryGeneratedColumn()
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  id!: number;

  //TODO сделать условным для sqlite/postgress
  @CreateDateColumn()
  @IsDate()
  createdAt!: Date;

  //TODO сделать условным для sqlite/postgress
  @UpdateDateColumn()
  @IsDate()
  updateAt!: Date;

  @ManyToOne(() => EnEntry, (w) => w.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word', referencedColumnName: 'word' })
  word!: EnEntry;

  @Column({ type: 'boolean', default: true })
  generated?: boolean;

  @Column({ type: 'text', nullable: true })
  generated_by_model?: string | null;

  @Column({ type: 'boolean', default: false })
  is_obsolete?: boolean | null;

  @Column({ type: 'boolean', default: false })
  is_abbreviation?: boolean | null;

  @Column({ type: 'simple-enum', enum: WordLevelE, nullable: true })
  word_level?: WordLevelE | null;

  @Column({ type: 'simple-enum', enum: EnAreaVariantsE, nullable: true })
  area_variant!: EnAreaVariantsE;

  @Column({ type: 'simple-enum', enum: CategoryE, array: true, default: [] })
  categories?: CategoryE[];

  @Column({ type: 'simple-enum', enum: LanguageRegisterE, nullable: true })
  language_register!: LanguageRegisterE;

  @Column({ type: 'simple-enum', enum: EnPartOfSpeechE })
  part_of_speech!: EnPartOfSpeechE;

  @Column({ type: 'simple-enum', enum: EnWordFormsE })
  form_of_word!: EnWordFormsE;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  transcription?: string | null;

  @ManyToOne(() => EnWord, { nullable: true, onDelete: 'SET NULL' })
  base_form?: EnWord | null;

  @OneToMany(() => EnWord, (e) => e.base_form, { onDelete: 'CASCADE' })
  forms!: EnWord[];

  @Column({ type: 'simple-json', nullable: true })
  pattern?: string[] | null;

  @OneToMany(() => EnMeaning, (meaning) => meaning.word, { onDelete: 'CASCADE', cascade: ['remove'] })
  meanings!: EnMeaning[];

  @OneToMany(() => EnShortTranslation, (tr) => tr.word, { onDelete: 'CASCADE', cascade: ['remove'] })
  short_translations!: EnShortTranslation[];

  /* ─────────────── NOUN ─────────────── */

  @Column({ type: 'boolean', nullable: true })
  noun___irregular_plural?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  noun___uncountable?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  noun___is_proper?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  noun___always_plural?: boolean | null;

  /* ─────────────── VERB ─────────────── */

  @Column({ type: 'boolean', nullable: true })
  verb___is_irregular?: boolean | null;

  @Column({ type: 'simple-enum', enum: EnVerbTransitivityE, nullable: true })
  verb___transitivity?: EnVerbTransitivityE | null;

  @Column({ type: 'boolean', nullable: true })
  verb___is_phrasal?: boolean | null;

  @ManyToOne(() => EnWord, { nullable: true, onDelete: 'SET NULL' })
  base_phrasal?: EnWord | null;

  @Column({ type: 'simple-enum', enum: EnPhrasalObjectPatternE, nullable: true })
  verb___phrasal_object_pattern?: EnPhrasalObjectPatternE | null;

  @OneToMany(() => EnWord, (e) => e.base_phrasal, { onDelete: 'SET NULL' })
  phrasal_variants?: EnWord[];
}
