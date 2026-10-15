import { EnPronunciationAudio } from './en_pronunciation_audio.entity';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EnAreaVariantsE } from '../../../../types';
import { EnWord } from './en_word.entity';

@Entity('en_pronunciations')
@Index('IDX_EN_PRONUNCIATION_WORD_ORDER', ['word', 'sort_order'])
@Check('CHK_EN_PRONUNCIATION_TYPE', `"type" IN ('ipa', 'enpr')`)
@Check('CHK_EN_PRONUNCIATION_AREA', `"area_variant" IN ('common', 'british', 'american', 'australian')`)
@Check('CHK_EN_PRONUNCIATION_ORDER', '"sort_order" >= 0')
export class EnPronunciation {
  /** Portable merge identity, assigned on first snapshot; never inferred from the row ID. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  sync_id?: string | null;

  @OneToMany(() => EnPronunciationAudio, (audio) => audio.pronunciation)
  audio?: EnPronunciationAudio[];

  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EnWord, (word) => word.pronunciations, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'word' })
  word!: EnWord;

  @Column({ type: 'text' })
  type!: 'ipa' | 'enpr';

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  @Column({ type: 'text' })
  area_variant!: EnAreaVariantsE;

  @Column({ type: 'int' })
  sort_order!: number;
}
