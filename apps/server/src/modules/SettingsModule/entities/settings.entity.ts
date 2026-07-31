import { Column, UpdateDateColumn, CreateDateColumn, PrimaryColumn, Entity } from 'typeorm';
import { IsDate } from 'class-validator';
import { checkIsPostgres } from '../../../../configuration';

@Entity('settings')
export class Settings {
  @PrimaryColumn({ type: 'varchar', length: 128, unique: true })
  field!: string;

  @CreateDateColumn({ type: checkIsPostgres() ? 'timestamptz' : 'datetime' })
  @IsDate()
  createdAt!: Date;

  @UpdateDateColumn({ type: checkIsPostgres() ? 'timestamptz' : 'datetime' })
  @IsDate()
  updateAt!: Date;

  @Column({ type: 'text' })
  value!: string;
}
