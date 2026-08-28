import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { WordFiltersV1QueryDTO } from './WordFiltersV1Query.dto';
import { toBoolean } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

export const PUBLIC_LIST_DEFAULT_LIMIT = 20;
export const PUBLIC_LIST_MAX_LIMIT = 100;
// A cursor encodes a headword (up to 128 chars) and an id; anything longer is not ours
export const PUBLIC_CURSOR_MAX_LENGTH = 512;

/** Query of GET /api/v1/words: the shared filters plus cursor paging and the optional joins */
export class ListWordsV1QueryDTO extends WordFiltersV1QueryDTO {
  @ApiPropertyOptional({ description: 'The `meta.next_cursor` of the previous page; omit for the first page' })
  @IsOptional()
  @IsString()
  @MaxLength(PUBLIC_CURSOR_MAX_LENGTH)
  cursor?: string;

  @ApiPropertyOptional({ type: 'integer', default: PUBLIC_LIST_DEFAULT_LIMIT, maximum: PUBLIC_LIST_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_LIST_MAX_LIMIT)
  limit?: number = PUBLIC_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Join the meanings of every word' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  with_meanings?: boolean = false;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Join the short translations of every word',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  with_translations?: boolean = false;
}
