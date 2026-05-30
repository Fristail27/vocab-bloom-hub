import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsDate, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { EnMeaning } from './en_meaning.entity';
import { AvailableTranslationLanguagesE } from '../../../../types';

@Entity('en_meanings_translations')
export class EnMeaningTranslation {
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

  @ManyToOne(() => EnMeaning, (entry) => entry.translation, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meaning' })
  meaning!: EnMeaning;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  definition!: string;

  @Column({ type: 'text', array: true })
  variantsOfWords!: string[];
}
