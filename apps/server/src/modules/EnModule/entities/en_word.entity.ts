import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
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
export class EnWord {
  @PrimaryGeneratedColumn()
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  id!: number;

  @CreateDateColumn({ type: 'datetime' })
  @IsDate()
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  @IsDate()
  updateAt!: Date;

  @ManyToOne(() => EnEntry, (w) => w.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word', referencedColumnName: 'word' })
  word!: EnEntry;

  @RelationId((entry: EnWord) => entry.word)
  word_text!: string;

  @Column({ type: 'boolean', default: true })
  generated?: boolean;

  @Column({ type: 'text', nullable: true })
  generatedByModel?: string | null;

  @Column({ type: 'boolean', default: false })
  is_obsolete?: boolean | null;

  @Column({ type: 'boolean', default: false })
  is_abbreviation?: boolean | null;

  @Column({ type: 'simple-enum', enum: WordLevelE, nullable: true })
  word_level?: WordLevelE | null;

  @Column({ type: 'simple-enum', enum: EnAreaVariantsE, nullable: true })
  area_variant!: EnAreaVariantsE;

  @Column({ type: 'simple-enum', enum: CategoryE, nullable: true })
  category?: CategoryE;

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
  forms?: EnWord[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  pattern!: string[];

  @OneToMany(() => EnMeaning, (meaning) => meaning.word_entry)
  meanings!: EnMeaning[];

  @OneToMany(() => EnShortTranslation, (tr) => tr.word_entry)
  shortTranslations!: EnShortTranslation[];

  /* ─────────────── NOUN ─────────────── */

  @Column({ type: 'boolean', nullable: true })
  noun___irregular_plural?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  noun___countable?: boolean | null;

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

  @OneToMany(() => EnWord, (e) => e.base_phrasal, { onDelete: 'CASCADE' })
  phrasal_variants?: EnWord[];
}
