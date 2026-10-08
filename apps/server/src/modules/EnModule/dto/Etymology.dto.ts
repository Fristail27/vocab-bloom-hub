import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class EtymologyDTO {
  @ApiProperty({
    required: false,
    description: 'Existing ID when editing this word. Omit to create; ignored on copy/import.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({ description: 'Positive local number; determines presentation order.' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  number!: number;

  @ApiProperty()
  @IsString()
  text!: string;
}
