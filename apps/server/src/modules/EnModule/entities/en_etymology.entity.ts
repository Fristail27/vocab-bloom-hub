import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EnWord } from './en_word.entity';

@Entity('en_etymologies')
@Index('IDX_EN_ETYMOLOGY_WORD_NUMBER', ['word', 'number'], { unique: true })
export class EnEtymology {
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
