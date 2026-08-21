import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Query-string values arrive as strings: a repeated key is already an array,
// a single key is a bare string, booleans come as 'true'/'false'
export const toArray = ({ value }: { value: unknown }) => (Array.isArray(value) ? value : [value]);
export const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export const LIST_MAX_LIMIT = 200;
export const LIST_DEFAULT_LIMIT = 50;

/** Pagination shared by the admin listings (GET /api/en/words, /meanings, /meaning-translations) */
export class PaginationQueryDTO {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: LIST_DEFAULT_LIMIT, maximum: LIST_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_MAX_LIMIT)
  limit?: number = LIST_DEFAULT_LIMIT;
}
