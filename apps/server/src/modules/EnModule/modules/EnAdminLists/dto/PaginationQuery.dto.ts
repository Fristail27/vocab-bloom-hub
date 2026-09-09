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

/**
 * Pagination shared by the admin listings (GET /api/en/words, /meanings,
 * /meaning-translations, /short-translations): numbered pages, ordered by
 * word, for the tables, or `after` — the id of the last row of the previous
 * page — for a walk over every row matching the filter. A walk goes in id
 * order of the listing's table: `id > after`, one index range per page
 * whatever the depth, where a numbered page past 50k rows sorts the whole
 * table again (the listing's sort key spans three tables, no index covers it).
 */
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

  @ApiPropertyOptional({
    description:
      'The id of the last row of the previous page (0 for the first page of a walk): the rows after it in id order are answered and `page` is ignored',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;
}
