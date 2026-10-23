import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DATASET_TARGET_PATTERN } from '../../../../core/constants/datasets';

export class SemanticSearchV1QueryDTO {
  @ApiProperty({
    description:
      'A description of the intended meaning, in English or another language supported by the model.',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  query!: string;

  @ApiPropertyOptional({
    description: 'One public dataset; omitted = active dataset. Closed/unknown targets return 404.',
    pattern: DATASET_TARGET_PATTERN.source,
  })
  @IsOptional()
  @IsString()
  @Matches(DATASET_TARGET_PATTERN)
  dataset?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
