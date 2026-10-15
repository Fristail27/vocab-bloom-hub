import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EnWord } from './en_word.entity';

@Entity('en_etymologies')
@Index('IDX_EN_ETYMOLOGY_WORD_NUMBER', ['word', 'number'], { unique: true })
export class EnEtymology {
  /** Portable merge identity, assigned on first snapshot; never inferred from the row ID. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  sync_id?: string | null;

  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EnWord, (word) => word.etymologies, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'word' })
  word!: EnWord;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'text' })
  text!: string;
}
