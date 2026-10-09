import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { OriginLicenseT } from '../../../../types';
import { EnPronunciation } from './en_pronunciation.entity';

@Entity('en_pronunciation_audio')
@Index('IDX_EN_AUDIO_PRONUNCIATION_ORDER', ['pronunciation', 'sort_order'])
@Check('CHK_EN_AUDIO_ORDER', '"sort_order" >= 0')
export class EnPronunciationAudio {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EnPronunciation, (pronunciation) => pronunciation.audio, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'pronunciation' })
  pronunciation!: EnPronunciation;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', nullable: true })
  source_url!: string | null;

  @Column({ type: 'text', nullable: true })
  attribution!: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  licenses!: OriginLicenseT[];

  @Column({ type: 'int' })
  sort_order!: number;
}
