import { IsNumber, IsDate, IsNotEmpty, IsPositive } from 'class-validator';
import {
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

export class EntityBase {
  @PrimaryGeneratedColumn()
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  id: number;
  @CreateDateColumn({ type: 'timestamptz' })
  @IsDate()
  createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  @IsDate()
  updateAt: Date;
}
