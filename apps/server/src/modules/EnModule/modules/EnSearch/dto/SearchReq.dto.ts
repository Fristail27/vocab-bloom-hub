import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EnEntryTypesE } from '../../../../../../types';

export class SearchReqDTO {
  @ApiProperty()
  @IsString()
  search!: string;

  @ApiPropertyOptional({ enum: EnEntryTypesE, description: 'Restrict the answer to one entry type' })
  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
