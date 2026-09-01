import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EnEntryTypesE } from '../../../../../../types';

// Headwords are at most 128 chars (the en_entries.word column), so a longer
// term can never match — reject it instead of running the search tiers on it
export const SEARCH_TERM_MAX_LENGTH = 256;

export class SearchReqDTO {
  @ApiProperty({ minLength: 1, maxLength: SEARCH_TERM_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_TERM_MAX_LENGTH)
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
